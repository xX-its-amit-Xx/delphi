#!/usr/bin/env node
// Screenshots of the live Design Studio page for this run.
//
//   node runs/flying-mouse/shoot.mjs
//
// The shooter itself lives in runs/_lib/shoot.mjs and takes --run, because there are four runs now and two
// copies of a screenshot harness are two things that can drift. This file is the entry point the README of
// this run has always named.
process.argv.push('--run', 'flying-mouse');
await import('../_lib/shoot.mjs');
