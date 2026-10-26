# Plan: CleanFrame på Samsung The Frame TQ43LS03BGU

Reference: [nthnclrk/CleanFrame](https://github.com/nthnclrk/CleanFrame), `docs/agent-tv-setup-guide.md`.
Status: kun plan. TV'et er ikke rørt.

## Mit TV vs. reference-TV'et

| | Reference | Mit TV |
| --- | --- | --- |
| Model | QA55LS03DAWXXY (LS03D, 2024) | TQ43LS03BGU (LS03B, 2022) |
| Tizen | 9.0, ARMv7 32-bit | forventet 6.5 – **skal bekræftes** |
| Firmware | T-PTMDUABC-0090-2130.0 | **ukendt** – aflæses i fase 1 |

`app/config.xml` kræver `required_version="6.5"`, så selve appen *bør* kunne installeres. Ældre browsermotor (Chromium ~85) kan give fejl i CSS/JS – testes i fase 0.

## Fase 0 – Forberedelse på Mac'en (risiko: ingen)
1. Fork CleanFrame til egen GitHub og klon hertil.
2. `npm ci && npm run dev:public` → test UI i browser.
3. `npm run check` + browser-checks.
4. Test evt. i en ældre Chromium (~v85) for at fange Tizen 6.5-inkompatibilitet.
5. Tilpas: egne apps (fx Netflix, YouTube, DR TV, TV 2 Play), dansk tid/24-timers ur.

## Fase 1 – Indsaml data (risiko: ingen)
- TV: **Indstillinger → Support → Om dette TV** → model + fuld softwareversion (foto eller tastet).
- TV's IP (Netværksstatus) og Mac'ens IP på samme LAN (ikke VPN).
- Gem i en privat setup-fil (ikke i git): IP'er, DUID, app-ID, signeringsprofil.

## Fase 2 – Developer Mode (risiko: lav, kan slås fra igen)
1. Apps → App-indstillinger → tast **1 2 3 4 5** på fjernbetjeningens nummerpad.
2. Developer Mode **On**, Host PC IP = Mac'ens IP.
3. Genstart – gerne helt strømløs (stik ud ~30 sek), det var nødvendigt på reference-TV'et.

## Fase 3 – Samsung-værktøjer og forbindelse (risiko: lav)
1. Installér Tizen Studio + TV Extension + Samsung Certificate Extension (tjek macOS/Apple Silicon-support).
2. `sdb connect <TV_IP>:26101` → aflæs **faktisk Tizen-version og CPU-arkitektur** + liste over installerede apps.
3. **Beslutningspunkt:** stopper hvis Tizen/arkitektur afviger markant.

## Fase 4 – Egne certifikater (risiko: ingen for TV'et)
- Samsung-konto (du logger selv ind).
- Certificate Manager → Samsung → TV: author- + distributor-certifikat med TV'ets DUID.
- Backup af author-certifikatet uden for projektet (nødvendigt for opdateringer).

## Fase 5 – Byg, signér, installér (risiko: lav – almindelig app, kan afinstalleres)
1. Generér **eget** package/app-ID via Tizen-wizarden; erstat `nClrkHome1.FrameHome` i `config.xml`, `scripts/tv.py`, `scripts/package.py`.
2. Map shortcuts til de *rigtige* app-ID'er fra dit TV.
3. Byg `.wgt`, signér med Samsungs officielle packager (håndlavet signatur blev afvist på reference-TV'et).
4. Installér; bemærk at `sdb install` alene kun uploadede på reference-TV'et – `vd_appinstall` skulle køres bagefter.

## Fase 6 – Test manuelt (risiko: ingen) — **anbefalet stoppunkt**
- Navigation med fjernbetjening, alle shortcuts, app-vælger.
- Bekræft vej tilbage til Samsung Home (`com.samsung.tv.csfs` på reference – verificér på dit).
- Her har du en ren launcher, som du åbner manuelt fra Apps.

## Fase 7–8 – Valgfrit: overtag Home-knappen (risiko: **høj**, udokumenteret)
Kun hvis fase 6 virker, og du udtrykkeligt accepterer risikoen.
- Metoden bruger en udokumenteret workaround til at køre en .NET-hjælper som UID 901 og ændre `vconf`-nøgler (`db/appfw/home_appid` m.fl.).
- **Ekstra usikkerhed for dig:** hjælperen er bygget til Tizen 9.0 med .NET 6. Det er uvist, om Tizen 6.5 har samme runtime, API'er og workaround. Kræver selvstændig kompatibilitetsanalyse.
- Før enhver skrivning: gem originale værdier, test restore, vær klar til at genskabe.
- **Gendan altid Home-værdierne før afinstallation** af launcheren.
- Firmwareopdateringer kan bryde det → overvej at slå automatisk opdatering fra.

## Privatliv (uafhængigt af CleanFrame)
- Afvis "Viewing Information Services", "Interest-Based Ads", stemmegenkendelse under Vilkår og privatliv.
- DNS-blokering via Pi-hole/NextDNS.
- Undgå Samsung-konto på TV'et hvis muligt.

## Åbne spørgsmål
- Præcis firmware/Tizen-version (fase 1/3).
- Hvilke apps skal være på hjemmeskærmen?
- Apple Silicon eller Intel Mac (påvirker Tizen Studio)?
- Ønsker du overhovedet fase 7–8?
