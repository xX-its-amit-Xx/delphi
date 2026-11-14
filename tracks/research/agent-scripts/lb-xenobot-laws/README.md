# lb-xenobot-laws

Reproduce (Git Bash, from this folder):

    python -I fetch_papers.py && python -I plug_in.py && bash D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/check.sh "$(pwd)/XenobotLaws.lean"; bash D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/check.sh "$(pwd)/XenobotLawsNegativeControl.lean"

Expected: sentences.txt and results.tsv rewritten; first check ends ALL CHECKED (13 axiom lines); second ends FAILED (sorryAx=1).
