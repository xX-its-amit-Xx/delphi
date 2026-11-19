// Front end: a behavioural description in a small Verilog subset -> a netlist of NOT / NOR / OR gates.
//
// The subset is deliberately tiny, because the point is not to parse Verilog, it is to have ONE
// unambiguous written form of the intended behaviour that a person can read and a machine can lower.
// Accepted:
//
//   module detector(a, b, out);
//     input a, b;
//     output out;
//     assign out = ~(a | b);     // operators: ~ (not), | (or), & (and), parentheses
//   endmodule
//
// Lowering follows the biology, not the textbook. A transcriptional NOT gate is one repressor driven
// by an input promoter; a NOR gate is the same repressor driven by two input promoters in series; an
// OR is two promoters in tandem in front of the next gate and costs no repressor. So:
//
//   ~x            -> NOT(x)
//   ~(x | y)      -> NOR(x, y)            one repressor, two input promoters
//   x | y         -> OR(x, y)             tandem promoters, no repressor
//   x & y         -> NOR(NOT x, NOT y)    de Morgan: AND needs three repressors
//
// `~(x | y)` is recognised as a single NOR rather than NOT(OR(..)) because that is how the gate is
// built in the cell; collapsing it afterwards would be guesswork about what the author meant.

export function parse(src) {
  const text = src.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const name = (text.match(/\bmodule\s+([A-Za-z_]\w*)/) ?? [])[1];
  if (!name) throw new Error('no module declaration found');
  const inputs = [...text.matchAll(/\binput\s+([^;]+);/g)].flatMap((m) => m[1].split(',').map((s) => s.trim())).filter(Boolean);
  const outputs = [...text.matchAll(/\boutput\s+([^;]+);/g)].flatMap((m) => m[1].split(',').map((s) => s.trim())).filter(Boolean);
  const assigns = [...text.matchAll(/\bassign\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g)].map((m) => ({ target: m[1], expr: m[2].trim() }));
  if (!outputs.length) throw new Error('no output declared');
  if (!assigns.length) throw new Error('no assign statement: nothing describes the behaviour');
  for (const a of assigns) if (!outputs.includes(a.target) && !inputs.includes(a.target)) outputs.push(a.target);
  return { name, inputs, outputs, assigns, ast: Object.fromEntries(assigns.map((a) => [a.target, parseExpr(a.expr)])) };
}

// ---- expression parser (recursive descent over ~ & | and parentheses) ----------------------------

function tokenize(s) {
  const out = [];
  const re = /\s*([A-Za-z_]\w*|[~&|()])/g;
  let m, last = 0;
  while ((m = re.exec(s))) { out.push(m[1]); last = re.lastIndex; }
  if (s.slice(last).trim()) throw new Error(`cannot read expression near "${s.slice(last).trim()}"`);
  return out;
}

export function parseExpr(s) {
  const t = tokenize(s);
  let i = 0;
  const peek = () => t[i];
  const eat = (x) => { if (t[i] !== x) throw new Error(`expected ${x}, found ${t[i] ?? 'end of expression'}`); i++; };

  function primary() {
    if (peek() === '(') { eat('('); const e = or(); eat(')'); return e; }
    if (peek() === '~') { eat('~'); return { op: 'not', a: primary() }; }
    const id = peek();
    if (!id || !/^[A-Za-z_]/.test(id)) throw new Error(`expected a signal name, found ${id ?? 'end of expression'}`);
    i++;
    return { op: 'wire', name: id };
  }
  function and() { let l = primary(); while (peek() === '&') { eat('&'); l = { op: 'and', a: l, b: primary() }; } return l; }
  function or() { let l = and(); while (peek() === '|') { eat('|'); l = { op: 'or', a: l, b: and() }; } return l; }

  const e = or();
  if (i !== t.length) throw new Error(`unread input after expression: ${t.slice(i).join(' ')}`);
  return e;
}

// ---- lowering to a gate netlist -----------------------------------------------------------------

export function netlist(mod) {
  const gates = [];
  let n = 0;
  const wire = () => `w${++n}`;

  // returns the wire name carrying the value of `e`
  function lower(e) {
    if (e.op === 'wire') return e.name;
    if (e.op === 'not') {
      // ~(x | y) is one NOR gate in the cell, not an OR followed by a NOT
      if (e.a.op === 'or') {
        const ins = flattenOr(e.a).map(lower);
        const out = wire();
        gates.push({ kind: 'NOR', inputs: ins, output: out, repressors_needed: 1 });
        return out;
      }
      const a = lower(e.a), out = wire();
      gates.push({ kind: 'NOT', inputs: [a], output: out, repressors_needed: 1 });
      return out;
    }
    if (e.op === 'or') {
      const ins = flattenOr(e).map(lower), out = wire();
      gates.push({ kind: 'OR', inputs: ins, output: out, repressors_needed: 0, note: 'tandem promoters, no repressor of its own' });
      return out;
    }
    if (e.op === 'and') {
      // de Morgan: x & y = ~(~x | ~y)
      const na = lower({ op: 'not', a: e.a }), nb = lower({ op: 'not', a: e.b }), out = wire();
      gates.push({ kind: 'NOR', inputs: [na, nb], output: out, repressors_needed: 1, note: 'the NOR of two inverted inputs (de Morgan)' });
      return out;
    }
    throw new Error(`cannot lower operator ${e.op}`);
  }

  const roots = {};
  for (const [target, ast] of Object.entries(mod.ast)) roots[target] = lower(ast);

  // every gate that feeds another gate, so the compiler knows which cascades need a noise margin
  const consumers = {};
  for (const g of gates) for (const i of g.inputs) (consumers[i] ??= []).push(g);
  const cascades = [];
  for (const g of gates) for (const c of consumers[g.output] ?? []) cascades.push({ from: g, to: c });

  return {
    module: mod.name,
    inputs: mod.inputs,
    outputs: Object.entries(roots).map(([port, w]) => ({ port, wire: w })),
    gates,
    cascades,
    repressors_needed: gates.reduce((s, g) => s + g.repressors_needed, 0),
  };
}

function flattenOr(e) { return e.op === 'or' ? [...flattenOr(e.a), ...flattenOr(e.b)] : [e]; }

export default { parse, parseExpr, netlist };
