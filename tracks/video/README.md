# One short video per feature

A feature is not shipped until someone who has never seen it can follow what it is in two minutes.
That is what this folder makes: a 1–2 minute explainer, built from the feature's own run output,
rendered locally, and published next to the feature's page.

    node tracks/video/render.mjs kernel            # the whole thing: voice, frames, mp4, captions
    node tracks/video/render.mjs kernel --dry      # just check every {{token}} still resolves
    node tracks/video/render.mjs kernel --no-audio --still five   # one frame, to look at a scene

Output lands in `C:/Temp/delphi-video/<id>/`: the mp4, a `.vtt` caption track, a poster frame and a
transcript. `tracks/<feature>/page.mjs` copies those next to the feature's page at publish time. The
video itself is **not committed** — the recipe is, and it regenerates the video, so the repo does not
carry a few megabytes per feature.

## What a script has to do

`scripts/<id>.json` holds the whole video: scenes, narration, and the one `data` file every number
comes from. The order of the beats is the thing to get right, and it is the same every time:

1. **what the thing is**, from first principles, in a sentence a person outside the field could repeat;
2. **what it was like before**, concretely, so the change has something to be a change *from*;
3. **what it does**, in its own smallest terms;
4. **who needs it** — three real situations, not a market;
5. **one number**, measured, with its source on screen;
6. **what is possible now that was not**, said plainly.

## The rules that keep it honest

- **No number is typed into a script.** Every figure is a `{{token}}` filled from the feature's run
  output. A token with no value stops the render. If the run's answer changes, the video is wrong
  until it is re-rendered, and `--dry` says so.
- **The source is on the screen**, not only in the caption: who measured it, and where it is printed.
- **Narration is a caption track, never burnt in.** Nothing on screen repeats the words being spoken.
- **Nothing is claimed that the feature does not do.** If something was refused, the video says it was
  refused. The refusals are usually the most interesting minute of the thing anyway.
- **It renders offline.** Windows' own speech synthesiser, a headless browser, a static ffmpeg. No
  text, no audio and no telemetry leave the machine, and no part of a script reaches a hosted service.
- **It reproduces**: frames are a function of the timeline, and the timeline is cut to the measured
  length of each spoken line, so the same script and the same run output give the same video.

## Pieces

| file | what it is |
|---|---|
| `render.mjs` | the driver: tokens, voice, timeline, frames, encode, captions |
| `narrate.ps1` | local speech synthesis; reports each line's exact duration |
| `scene.html` | the stage; draws one frame for a given time in milliseconds |
| `scripts/<id>.json` | one feature's video |

Needs `ffmpeg-static` (`C:/Temp/ffmpeg-install`) and the Playwright core used elsewhere in the repo,
driving Edge. Override with `DELPHI_FFMPEG` and `DELPHI_PLAYWRIGHT`.
