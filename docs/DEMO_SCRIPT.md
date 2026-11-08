# Sweety demo recording script (2–3 minutes)

## Before recording

- Start PostgreSQL with `docker compose up -d`.
- Configure the server and client `.env` files, then run `npm run migrate` and `npm run seed` from `server`.
- Start `npm run dev` in both `server` and `client`.
- Open `http://localhost:5173` and make sure the API is healthy at `http://localhost:3000/health`.
- Keep one date such as today available for the new account's readings. For the seeded demo reports, use `2026-11-07` (the current seed snapshot used for this recording) or select another date within the generated date range.

## Recording sequence

| Time | Screen action / narration |
|---|---|
| 0:00–0:15 | Introduce Sweety as a glucose tracker. Show the registration screen and explain that passwords are stored as bcrypt hashes. |
| 0:15–0:35 | Register a new user with a name, email, and matching password. Show the Dashboard and its date picker, empty state, and “0 of 4 readings added” counter. |
| 0:35–0:55 | Add two readings on the selected date, e.g. Morning (fasting) `95` and After breakfast `130`. Point out the mg/dl display and that the list refreshes after each save. |
| 0:55–1:25 | Demonstrate validation. Submit an empty value for “Please enter a glucose value.”; enter `700` for “Value must be between 40 and 600 mg/dl.”; try the already-used morning slot for “You already have a Morning (fasting) reading for this date.”; change the date to tomorrow for “Date cannot be in the future.”; then restore today and add unique slots until four readings exist, and attempt a fifth for “You can add only 4 readings per day.” If showing invalid calendar input, clear or corrupt the date and submit to show “Please enter a valid date.” |
| 1:25–1:45 | Edit a reading, change its value, and save. Then delete a reading and accept the confirmation prompt. Show the updated count and list. |
| 1:45–2:10 | Open Reports. Choose `2026-10-15` to show the daily, month-to-date, and previous-month ranges: `15 Oct 2026`, `1 Oct – 15 Oct 2026`, and `1 Sep – 30 Sep 2026`. Show the daily slot list and the month chart on a date with seeded readings. |
| 2:10–2:30 | Log out, then log in as `demo@sweety.test` with password `Demo@1234`. Select a date in the seeded range and show that the demo account has readings and report data. |
| 2:30–2:40 | Close by noting that the API scopes readings by user and that tests cover the server validation and client flows. |

## Recording notes

- Keep the date picker at or before today. The date validation is server-side; the date picker also sets its maximum to today.
- Date values in the form are `YYYY-MM-DD`; report labels are formatted without parsing those strings as timezone-dependent JavaScript dates.
- For the daily limit example, use four distinct slots on the same date before attempting the fifth.
- The new account's sample readings are separate from the demo user's deterministic seeded records.
