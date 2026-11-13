"""Part 2: one-job/two-resin, Open Material Mode, resin swap, contamination."""
from build_part1 import F, K

# ---------- A. two resins in one job ----------
F("Form 4 cannot hold two resins in one print job: one resin tank and one cartridge are used per print, and changing material means changing both. (Direct statement of the swap rule; no Formlabs page was found that offers a two-resin job.)",
  "manual", "high", "1 tank + 1 cartridge per print; change both to change resin",
  "When changing resin types, always change both the resin tank and resin cartridge.")
K("A Form 4 print uses a single resin tank and cartridge; changing resin type means changing both, so a two-resin strip needs two separate prints.",
  "manual", "When changing resin types, always change both the resin tank and resin cartridge.")
F("Form 4 manual: the printer checks the consumables before each print, so a tank/cartridge pair is validated for one material.",
  "manual", "high", "sensor check of tank, cartridge, platform",
  "Accessories: Sensors check for the proper installation of the build platform, resin tank,")
F("Replacing the tank is the documented way to change materials between prints.",
  "manual", "high", "tank replacement = material change",
  "Replace the resin tank to change materials between prints or when a resin tank is damaged")
F("PreForm job setup asks for one material per job: 'Select the material you wish to print in.' A Formlabs forum reply says each job is only compatible with the resin and layer thickness chosen when it is sent.",
  "f_incompat", "medium", "one material per job",
  "So each job sent to the printer is only compatible with the resi")
F("PreForm Insider (pre-release) notes from 28 April 2026 list 'Multi-material capability across multiple build volumes' and from 1 April 2026 'Multiple build volumes in one window in PreForm'. No description is given. My reading (inference, not stated): each build volume (= separate print job) can carry its own material; it does not put two resins into one tank. Needs checking with Formlabs before the plan relies on either reading.",
  "insider", "low", "Insider 3.58.0 build 405, 2026-04-28",
  "Multi-material capability across multiple build volumes")
F("A Formlabs forum thread on multi-material prints contains no Formlabs staff answer. A commenter says two resins mixed in one tank cannot be cured selectively and that no narrow-wavelength resin pair is known to them.",
  "f_multimat", "low", "no staff answer",
  "")
F("The Form 4 manual lists a pause control only as 'Pause > Abort'; no documented pause-and-swap-resin workflow was found.",
  "manual", "medium", "no resume-after-swap procedure documented",
  "To stop a print in progress, tap Pause > Abort on the printer's touchscreen.")
F("Printing onto a part already attached to the build platform is not supported on Form 3 per a forum reply: the mixer sweeps across the platform face at start-up and detaches with an error if anything is on it. The Form 4 manual says its mixer and sensors check for debris on the platform; I found no Form 4 statement about a pre-attached part. Untested on Form 4.",
  "f_printon", "medium", "Form 3: blocked; Form 4: unknown",
  "the mixer runs across that face of the build platform and if there is anything on the build platform the mixer detaches with an error that stops the startup.",
  src2=["manual"])
F("Form 4 start-up check: debris on the build platform is checked by the mixer and sensors.",
  "manual", "high", "debris check",
  "Debris: The mixer and sensors check for debris left on the build platform.")
F("Forum advice for printing on a glass slide on Form 3B: glue the glass to the build plate, reset the height offset in the printer settings, and expect suction and peel risk. This is user opinion, not Formlabs guidance.",
  "f_printobj", "low", "workaround, not supported",
  "Because the Formlabs printers are hanging you would need to attach the glass to the build plate, reset the height offset, and hope it sticks and doesn't get pulled off from the suction forces.")

# ---------- B. Open Material Mode ----------
F("Open Material Mode (OMM) lets Formlabs SLA printers (Form 3, 3L, 4, 4L generations) print any 405 nm photopolymer resin; it is a one-time lifetime fee per printer.",
  "omm_sla", "high", "405 nm resins; one-time fee",
  "With Open Material Mode, you can print with any type of 405 nm photopolymer resin on Formlabs SLA printers. Open Material Mode is available for a one-time lifetime fee per printer.")
K("Open Material Mode is a paid, per-printer licence needed for any non-Formlabs resin (for example a hydrogel active layer); stock Formlabs resins do not need it.",
  "omm_sla", "With Open Material Mode, you can print with any type of 405 nm photopolymer resin on Formlabs SLA printers. Open Material Mode is available for a one-time lifetime fee per printer.")
F("OMM minimum software on Form 4 generation: printer firmware 1.6.0 and PreForm 3.38.1 or later; OMM jobs can only be set up in the Standard Workspace.",
  "omm_sla", "high", "Form 4: firmware >=1.6.0, PreForm >=3.38.1",
  "Open Material Mode jobs can only be set up in the Standard Workspace.")
F("OMM activation needs an activation code and a temporary internet connection; no connection is needed afterwards. Form 4B / 4BL printers come with OMM access.",
  "omm_setup", "high", "internet only at activation",
  "An active internet connection is not required after activation to print with Open Material Mode.")
F("With OMM you create a custom print setting in the PreForm Print Settings Editor by copying a validated Formlabs setting and toggling 'Open Material' on, then editing other parameters.",
  "omm_sla", "high", "copy a Formlabs setting; toggle Open Material",
  "Toggle Open Material to ON . The toggle turns blue.")
F("OMM printer behaviour: resin is poured by hand, a dedicated tank is required (the printer programs the tank for open materials), resin level is not sensed, the tank/cartridge mismatch check is disabled, and tank-lifetime warnings are off.",
  "omm_sla", "high", "manual fill; dedicated tank; no level sensing",
  "Use a dedicated tank for printing with Open Material Mode. The printer automatically programs the tank for use with open materials.")
F("OMM: if the tank runs dry the print fails; the user must keep the level between the printed min/max fill lines on a Form 4 tank.",
  "omm_sla", "high", "min/max fill lines on Form 4 tank",
  "If the resin tank runs dry, your print will fail.")
F("OMM may shorten tank life and heating can evaporate volatile components from third-party resins (ventilation advised).",
  "omm_sla", "high", "tank life may shorten",
  "Depending on the non-Formlabs resin you are printing with, the tank lifetime may be shortened.")
F("Formlabs store: with OMM some failure modes more likely caused by third-party materials are excluded from the standard warranty. A reseller FAQ lists them: resin spill, resin tank damage/wear/leak, mixer damage/wear/decoupling, build platform damage, hardware damage from volatile ingredients; and says Formlabs Customer Support cannot help troubleshoot non-Formlabs resins.",
  "omm_store", "high", "warranty carve-out",
  "When using Open Material Mode, some failure modes that are more likely to be caused by third-party materials are excluded from our standard warranty.",
  src2=["omm_mh"])
F("Reseller FAQ text (MatterHackers): the exclusions are listed as resin spill, tank damage/wear/leak, mixer damage/wear, build platform damage and volatile-evaporation damage.",
  "omm_mh", "medium", "reseller restatement of Formlabs terms",
  "Resin Tank damage, wear, or leak")
F("OMM price: Formlabs pages say 'Because pricing can change, visit the Open Material Mode product page for current pricing' and state no number. A reseller (Proto3000) listed SKU SFT-OMM-F4-1 at a current price of $3,748.50 (currency not stated on the fetched page; original-price range $2,998.50 to $5,998.50), listed as out of stock when fetched. A search snippet attributed a launch figure of about $2,500 for Form 4 to a trade article; I did not fetch that article.",
  "omm_proto", "low", "~$3.7k (reseller, 2026-11-12)",
  "Current price $3,748.50", src2=["omm_store"])
F("OMM for SLS (Fuse 1, Fuse 1+ 30W, Fuse X1) is the same mechanism for 1064 nm powders; Fuse 1+ needs firmware 1.20.0 and PreForm 3.41.0 or later.",
  "omm_sls", "high", "Fuse 1+ 30W: fw >=1.20.0",
  "With Open Material Mode, you can print with any type of 1064 nm powder on Formlabs SLS printers.")

# ---------- C. swap and contamination ----------
F("Mixer: when switching resin types the mixer must be cleaned with IPA or TPM (wipe or in a Form Wash) and dried before reinserting; Formlabs also recommends replacing the mixer whenever the tank is replaced.",
  "maint", "high", "clean 0.2 h per swap",
  "If you are reusing the same mixer with multiple resin types, fully clean the mixer when you change to a new resin.",
  src2=["manual"])
F("Build platform: when switching resin type, clean the platform surface and edges with IPA and low-fibre towels; with the same resin no cleaning is needed between prints.",
  "manual", "high", "IPA wipe of platform at swap",
  "clean the surface and edges of the build platform with isopropyl alcohol and low-fiber")
F("Each Form 4 tank carries an RFID tag that records tank ID and current resin type.",
  "manual", "medium", "RFID tank tag",
  "unique tank ID and current resin type.")
F("Remove the cartridge before the tank to stop the bite valves dripping resin into the printer cavity; inspect bite valves for cured resin when switching cartridges.",
  "manual", "high", "order: cartridge first, then tank",
  "Remove the resin cartridge before removing the resin tank to prevent the bite valves from dripping resin")
F("Rigid 10K (glass-filled) needs its own wash bucket so glass particles do not stick to parts of other resins; Silicone 40A may only be washed in an unused Form Wash bucket with an IPA/n-butyl acetate mixture and that bucket must never go back to pure IPA.",
  "wash", "high", "separate buckets",
  "Rigid 10K Resin contains glass particles, which strengthens printed parts. Maintain separate wash buckets to prevent glass particles adhering to parts printed with other resins.")
F("Do not pour used resin back into the cartridge: cured pieces and debris can cause print failures.",
  "manual", "high", "contamination via cured bits",
  "Pouring resin back into the original resin cartridge may risk contaminating the resin")
