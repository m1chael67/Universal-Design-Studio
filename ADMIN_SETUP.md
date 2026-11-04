# Design Studio administrator (read-only accounts and projects)

The built-in Appwrite Console already lets project administrators view:
- **Auth → Users**: every account registered in this specific Design Studio Appwrite project.
- **Databases → Projects → Rows**: every cloud project row (including `ownerId`).

This is sufficient immediately, without creating any new user or weakening existing row permissions.

## Optional in-app admin dashboard

The Design Studio app includes an admin panel shown only when signed in as `michael@universalrentalstl.com`. Until the server function is connected, it shows the setup instructions and Appwrite Console shortcut.

**Do not grant table-wide READ to authenticated users or Anyone to make the admin page work.** Instead, deploy the included protected server Function. It reads the accounts and project metadata using an API key that remains on the server.

### 1. Establish the admin user ID

In this Design Studio Appwrite project go to **Auth → Users**, open the registered user with email `michael@universalrentalstl.com`, and copy its actual Appwrite User ID (not its email). Use that ID for the admin Function setting below.

### 2. Create a read-only server API key

In **Project Settings → API Keys**, create a key with the minimum scopes required for **reading Users** and **reading TablesDB rows** (usually `users.read` and `rows.read`; use the scope names shown in your Appwrite Console).

**Never paste this API key into the Design Studio site, GitHub, `VITE_*` environment variables, or a chat.** The key is only for the server Function.

### 3. Deploy the Appwrite Function

Create a Node.js Appwrite Function named **Design Studio Admin**. Configure:
- GitHub repository: `m1chael67/Universal-Design-Studio`
- Branch: `main`
- Root directory: `functions/design-admin`
- Install command: `npm install`
- Entrypoint: `src/main.js`
- Function execute access: **All users** (authenticated). A server-side check independently verifies the real caller's signed Appwrite JWT, exact account ID, and account email before returning anything.
- No HTTP domain is needed; call it via Appwrite Functions SDK.

In **Function → Settings → Environment variables**, create:
- `DESIGN_ADMIN_USER_ID`: exact Appwrite Auth user ID from step 1.
- `DESIGN_ADMIN_API_KEY`: API key created in step 2, marked **Secret**.

Deploy the Function, then copy its **Function ID**.

### 4. Connect the frontend

In the **Universal Design Studio Site → Settings → Environment variables**, create:
- `VITE_DESIGN_ADMIN_FUNCTION_ID`: the function ID (this ID is public and not sensitive).

Redeploy the Site. Log in as the specified admin account, then expand **Design Studio Admin — Accounts & Projects** in the Cloud Projects section. Click **Refresh accounts & projects**.

The admin panel groups projects by owner email and shows project name, number of tents, number of interior objects, and last update time. It is intentionally **read-only**.

The Function returns at most 1,000 users / 1,000 project rows in one execution to keep responses bounded. For larger workspaces or additional operations, we'll add server-side pagination.

## Security boundaries

- Being signed in with an arbitrary account is not enough. The server verifies the Appwrite session JWT against Appwrite Auth and compares **both** the authenticated User ID and configured admin email.
- All regular users' cloud rows retain existing row-level permissions.
- The Function API key remains in Function secrets only.
- Do not use a client-side email equality check as the sole authorization gate.
- The Function is separate from the Universal Crew App and uses the **Design Studio Appwrite project only**.
