# Speak each line of a video script to a WAV file, locally, and report how long each one took.
#
#   powershell -NoProfile -File tracks/video/narrate.ps1 -Lines <lines.json> -Out <dir> [-Voice "Microsoft Zira Desktop"] [-Rate 0]
#
# <lines.json> is [{ "id": "...", "text": "..." }, ...]. One <id>.wav is written per line and a JSON
# array of { id, wav, seconds } is printed on stdout. The durations drive the video's timeline, so the
# picture is cut to the voice rather than the voice squeezed into a guessed duration.
#
# Windows' own speech synthesiser does the work. Nothing is uploaded: no text, no audio, no network.
param(
  [Parameter(Mandatory = $true)][string]$Lines,
  [Parameter(Mandatory = $true)][string]$Out,
  [string]$Voice = "Microsoft Zira Desktop",
  [int]$Rate = 0
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

if (-not (Test-Path $Out)) { New-Item -ItemType Directory -Force -Path $Out | Out-Null }

$script = Get-Content -Raw -Path $Lines | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$installed = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
if ($installed -contains $Voice) { $synth.SelectVoice($Voice) }
else { Write-Error "voice '$Voice' is not installed; have: $($installed -join ', ')" }
$synth.Rate = $Rate

# 44.1 kHz, 16-bit, mono: one fixed format, so a duration is a byte count and the render is repeatable.
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
  44100,
  [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
  [System.Speech.AudioFormat.AudioChannel]::Mono)
$bytesPerSecond = 44100 * 2

$results = @()
foreach ($line in $script) {
  $wav = Join-Path $Out ($line.id + ".wav")
  $synth.SetOutputToWaveFile($wav, $fmt)
  $synth.Speak($line.text)
  $synth.SetOutputToNull()
  $len = (Get-Item $wav).Length
  $seconds = [math]::Round(($len - 44) / $bytesPerSecond, 3)
  $results += [ordered]@{ id = $line.id; wav = $wav; seconds = $seconds; bytes = $len }
}
$synth.Dispose()

$results | ConvertTo-Json -Depth 4 -Compress
