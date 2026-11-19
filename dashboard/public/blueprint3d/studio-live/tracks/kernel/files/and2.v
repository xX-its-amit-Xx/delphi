// A two-input AND, written as behaviour rather than as parts.
//
// In a cell this cannot be one gate: a transcriptional gate inverts, so an AND is built as the NOR of
// two inverted inputs. The compiler does that lowering (de Morgan) and then has to find three
// repressors that do not cross-react, with enough margin between each gate's output levels and the
// next gate's threshold. Stanton et al. (2014) built exactly this circuit, which is why it is the
// test case: there is a published result to be wrong against.
//
// Run:  node tracks/kernel/compile/compile.mjs tracks/kernel/compile/designs/and2.v

module and2(a, b, out);
  input a, b;
  output out;
  assign out = a & b;
endmodule
