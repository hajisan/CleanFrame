# Native Home control

This one-shot development helper is scoped to Nathan's Frame and firmware 2130.0. It does not run inside CleanFrame or remain active on the TV. It uses the existing SDB developer connection and the published package-name command workaround to execute as SDK UID 901. It does not request root or change security policy.

`Control.cs` exposes read-only query, guarded apply, and exact-value restore through native Home and vconf APIs. It refuses other firmware, root, changed original values, or an ineligible/missing app. Apply failures attempt immediate restore. The baseline and compiled tools remain in ignored `.local/native-home/`.

From the project root:

```sh
python3 scripts/native-home/run.py query
python3 scripts/native-home/run.py restore
```

The existing private `original.json` is the tested rollback baseline. Do not overwrite it with the applied state. The runner re-stages the helper and baseline each time. The query/apply/restore/inspect shell source is retained beside the runner. It needs the compiled output in `.local/native-home/out/`; build with the private verified Microsoft SDK when the C# source changes. No local address, device identifier, compiled binary or signing secret belongs in this source folder.

Even query/inspect stages temporary helper files on the device. These are device operations, not offline repository checks. A clone without the private baseline, SDK and compiled output cannot perform the tested rollback. Preserve the local recovery folder separately; GitHub is a source backup only.

The implementation was reviewed against the [published S90D native Home work](https://github.com/splitcipher/couchroot/blob/83906b468836869933012da03a4018fb339462b3/docs/devices/s90d/README.md). This Frame's native query, apply/restore/reapply and physical Home-from-Netflix test were checked independently. Source review does not replace device testing after future firmware changes.

## Firmware without the compiled helper

`Control.cs` is deliberately tied to one firmware and app identity. Before adapting it, check whether the TV already has what the helper exists to provide. A 2022 LS03B on Tizen 6.5 did:

- `/usr/bin/aul_test` exposes `get_default_app <operation>` and `set_default_app_by_operation <operation> <appid>`, so the `http://tizen.org/appcontrol/operation/main` assignment can be read and set directly. `Control.cs` wraps the same functions through libaul.
- `/usr/share/dotnet/shared/Microsoft.NETCore.App` carried 2.0 to 3.1 on that set, not the 6 runtime the helper targets.
- `vconftool set` needs `-f` to overwrite an existing key. Without it the write is refused and nothing changes.
- The SDB transport above works unchanged there and still lands on UID 901.

On that firmware all four typed keys named `com.samsung.tv.csfs`, and setting the Home operation plus `db/appfw/home_appid` made the TV derive `startup_appid` and `booting_appid_backup` itself, while `db/first_screen/type` stayed on Samsung Home. Write nothing before capturing the AUL operation and every typed key, and read each write back; a refused or unreadable value means restore immediately.

These are undocumented tools and key names on one model. Having `aul_test` does not make every firmware's keys equivalent, and the guards in `Control.cs` are there for that reason.
