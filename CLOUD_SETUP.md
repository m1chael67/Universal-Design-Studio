# Universal Design Studio V0.8 — one-time cloud setup

These settings belong **only** to the separate **Universal Design Studio** Appwrite project, ID `6aea8c410001e8aed9b1` (NYC region). Do not change the Universal Crew app's backend.

## 1. Automatic Mapbox loading on every computer

The GitHub repository blocks storing the Mapbox token. Instead it is injected into the browser build from Appwrite Site settings.

1. In Appwrite, open **Sites** → **Universal Design Studio** → **Settings** → **Environment variables**.
2. Click **Create variable**.
3. Key: `VITE_MAPBOX_PUBLIC_TOKEN`
4. Value: **the existing Mapbox public token**, the one beginning with `pk.` that already works in your browser.
5. Leave the variable as a normal public build variable. It will be included in client-side JavaScript by Vite, which is appropriate for *public* Mapbox tokens. Never use a secret Mapbox (`sk.`) or Appwrite API key here.
6. Save and **redeploy the Appwrite Site** to make the new variable available at build time.

When configured, the site loads the map automatically on all computers. The older browser-local Mapbox token remains a temporary fallback if the variable has not yet been added.

For best protection, create a *dedicated* Mapbox public token with minimum necessary scopes and an allowed URL restriction for `https://universal-design-studio.appwrite.network`, then use that token for the variable. Do not restrict your default public Mapbox token: Mapbox does not support URL restrictions on its default token.

## 2. Enable private cloud projects in Appwrite

1. In Appwrite Console, select project **Universal Design Studio** (not the crew app).
2. Open **Databases** and create a database:
   - Name: `Design Studio`
   - ID: `6aeb3dfa001293738040` (already created)
3. Inside it create a **Table**:
   - Name: `Projects`
   - ID: `6aeb3e0500094b2a9ae4` (already created)
   - **Row Security: ON**
4. Add these columns (field names are case-sensitive):

   | Column key | Type | Size | Required |
   |---|---|---|---|
   | `name` | varchar | 256 | Yes |
   | `ownerId` | varchar | 64 | Yes |
   | `payload` | mediumtext | n/a | Yes |

5. In **Table → Settings → Permissions**, grant **CREATE** to **Authenticated users** (`Role.users()`). Do **not** grant table-level READ, UPDATE, or DELETE to Anyone or All users.
6. Keep **Row Security** turned on. The Design Studio code creates each row with read/update/delete permissions granting access only to the user who owns it.
7. Under the Appwrite project's platform settings, register the web hostname `universal-design-studio.appwrite.network` if it is not already registered by your Appwrite Site.
8. Refresh Universal Design Studio. Create a new Design Studio email/password login (not the crew app PIN), then choose **Save current plan as new cloud project**.

For subsequent use, the account session and cloud project list are available from any computer using the same Design Studio login. The original browser project remains in localStorage; cloud data isn't public.

## 3. Undo and Redo

- **Ctrl+Z** on Windows / **Cmd+Z** on Mac: undo.
- **Ctrl+Shift+Z** or **Ctrl+Y** on Windows / **Cmd+Shift+Z** on Mac: redo.
- Site and interior editors also have visible Undo and Redo buttons.
- Edits made during continuous dragging are grouped into one history step to keep the stack usable.
- Undo/redo history is for the open editing session. Cloud and JSON preserve the latest design, not the history stack.

## 4. Before relying on cloud

Test creating a project, adding and moving a tent, opening its interior and placing furniture, waiting for the **Cloud saved** label, and opening the same project after signing in on another computer.

The app compares server revision timestamps on save and stops on a detected cross-device conflict instead of silently overwriting. To keep conflicting edits, use **Save current plan as new cloud project**.

For safety, export a JSON backup of any especially important project. Offline use and interruptions in network access should not be mistaken for a successful cloud save.

## Security boundaries

- Public browser Mapbox token: okay in `VITE_MAPBOX_PUBLIC_TOKEN`; restrict to your site URL if possible.
- Appwrite project ID and endpoint: public.
- **Do not** put an Appwrite API key, server key, crew PIN pepper, or a secret Mapbox token in environment variables starting with `VITE_` or in the repository.
- The cloud table must have row security enabled and must not grant table-level read/update/delete to all users.
