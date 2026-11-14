#!/bin/sh
# gen <file> <slug> <label> <verdict> <acc> <A> <C> <G> <T> <AT> <GC> <desc>
gen() {
cat > "$1" <<TRIG
@prefix this: <http://purl.org/nanopub/temp/$2/> .
@prefix sub: <http://purl.org/nanopub/temp/$2/> .
@prefix np: <http://www.nanopub.org/nschema#> .
@prefix npx: <http://purl.org/nanopub/x/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix delphi: <https://w3id.org/delphi/ontology/> .
@prefix claim: <https://w3id.org/delphi/resource/claim/> .
@prefix agent: <https://w3id.org/delphi/resource/agent/> .

# UNSIGNED DRAFT. Temp URI, no trusty hash, no signature, no human ORCID. Not published.

sub:Head {
  this: a np:Nanopublication ;
    np:hasAssertion sub:assertion ;
    np:hasProvenance sub:provenance ;
    np:hasPublicationInfo sub:pubinfo .
}

sub:assertion {
  claim:chargaff-second-parity-rule a delphi:Hypothesis ;
    rdfs:label "Within one strand of a double-stranded DNA genome, count(A) is about count(T) and count(G) is about count(C)." ;
    delphi:formalStatement "abs(nA/nT - 1) <= 0.05 and abs(nG/nC - 1) <= 0.05, counted on the single deposited strand" ;
    delphi:hasAssessment sub:assessment .
  sub:assessment a delphi:Assessment ;
    rdfs:label "$3" ;
    delphi:evaluatesHypothesis claim:chargaff-second-parity-rule ;
    delphi:assessmentType "single-genome-base-count" ;
    delphi:hasVerdict "$4" ;
    dct:description "$12" ;
    delphi:hasEvidence sub:evidence .
  sub:evidence a delphi:Evidence ;
    dct:source <https://www.ncbi.nlm.nih.gov/nuccore/$5> ;
    schema:variableMeasured
      [ a schema:PropertyValue ; schema:name "nA" ; schema:value "$6"^^xsd:integer ] ,
      [ a schema:PropertyValue ; schema:name "nC" ; schema:value "$7"^^xsd:integer ] ,
      [ a schema:PropertyValue ; schema:name "nG" ; schema:value "$8"^^xsd:integer ] ,
      [ a schema:PropertyValue ; schema:name "nT" ; schema:value "$9"^^xsd:integer ] ,
      [ a schema:PropertyValue ; schema:name "nA/nT" ; schema:value "${10}"^^xsd:decimal ] ,
      [ a schema:PropertyValue ; schema:name "nG/nC" ; schema:value "${11}"^^xsd:decimal ] .
}

sub:provenance {
  sub:assertion prov:wasAttributedTo agent:hv-nanopub-format ;
    prov:wasDerivedFrom <https://www.ncbi.nlm.nih.gov/nuccore/$5> ;
    prov:wasGeneratedBy sub:activity .
  sub:activity a prov:Activity ;
    rdfs:label "NCBI efetch FASTA for $5 on 2026-11-13; letters counted with grep/fold/sort/uniq; tolerance 0.05 chosen by the agent, not taken from a source" .
}

sub:pubinfo {
  this: dct:created "2026-11-13T00:00:00Z"^^xsd:dateTime ;
    dct:creator agent:hv-nanopub-format ;
    rdfs:label "Draft: $3" ;
    dct:license <https://creativecommons.org/licenses/by/4.0/> ;
    npx:hasNanopubType delphi:Assessment ;
    npx:introduces sub:assessment ;
    rdfs:comment "Unsigned draft, not published. Creator is a software agent; a key holder's identity is added only if that person approves and signs. Timestamp is date-only precision." .
  agent:hv-nanopub-format a prov:SoftwareAgent ;
    rdfs:label "DELPHI harvest agent hv-nanopub-format (language model, no human identity)" .
}
TRIG
}
gen example-1-lambda.trig ex1 "Chargaff second parity rule on phage lambda: A/T within 5 percent, G/C not" "refuted-at-stated-tolerance" NC_001416.1 12334 11362 12820 11986 1.029 1.128 "One genome of 48502 bases. A/T = 1.029 passes; G/C = 1.128 fails the 5 percent tolerance. Does not show the rule fails for large genomes; one small genome only."
gen example-2-phix174.trig ex2 "Chargaff second parity rule on phage phiX174: both ratios outside 5 percent" "refuted-at-stated-tolerance" NC_001422.1 1291 1157 1254 1684 0.767 1.084 "One genome of 5386 bases. A/T = 0.767 and G/C = 1.084 both fail. The virion DNA is single-stranded, so the rule's double-strand assumption is not met; this is an out-of-scope case, recorded as such."
gen example-3-human-mito.trig ex3 "Chargaff second parity rule on the human mitochondrial genome: both ratios far outside 5 percent" "refuted-at-stated-tolerance" NC_012920.1 5124 5181 2169 4094 1.252 0.419 "16569 positions, one of them N (excluded). A/T = 1.252 and G/C = 0.419 both fail. Says nothing about nuclear chromosomes."
