# MobiSafe eWay Portal - User Guide

---

## 1. Login

Open the portal URL in your browser. You will see the login page.

Enter the **Email** and **Password** provided to you by MobiSafe, then click **Sign In**.

<image of login page>

---

## 2. Set Up eWay Authentication (Admin)

After logging in, click **eWay Authentication** in the left sidebar.

<image of sidebar with eWay Authentication highlighted>

Fill in the following fields:

| Field | Description |
|-------|-------------|
| **GSTIN** | Your 15-character GST Identification Number (e.g., `27AAIFM5685P1ZC`) |
| **eWay Username** | Your eWay Bill portal username |
| **eWay Password** | Your eWay Bill portal password |

Click **Authenticate**.

<image of eWay Authentication page with fields filled>

On success, you will see a confirmation message with the token expiry time. Your GSTIN is now saved and shown as **Active** at the top of the page.

<image of successful authentication with Active badge>

> **Note:** The token auto-renews when it expires. You only need to re-authenticate if you change your eWay credentials.

---

## 3. Configure State Codes (Admin)

Click **State Codes** in the left sidebar.

This page shows all Indian GST state codes. Select the states from which you receive eWay bills as a transporter. For example, if you operate across Gujarat, Maharashtra, and Tamil Nadu, select:

- **24** - Gujarat
- **27** - Maharashtra
- **33** - Tamil Nadu

You can use **Select All** or **Clear All** for quick selection.

<image of State Codes page with some states selected>

Your selected states appear as chips at the top. Click **Save** when done.

<image of selected state chips and Save button>

---

## 4. Fetch eWay Bills

Click **Fetch Bills** in the left sidebar (this is also the default landing page).

At the top you will see your configured GSTIN and state codes.

<image of Fetch Bills page header showing GSTIN and state chips>

### Steps:

1. **Select a date** using the date picker
2. Click **Fetch Bills**

<image of date picker and Fetch Bills button>

The system will:
- Query each configured state for transporter bills on that date
- Collect all unique eWay bill numbers
- Fetch full details for every bill

A progress bar shows the current status.

<image of progress bar while fetching>

### Results

After fetching, you will see:
- **Stats cards** showing the number of states queried and total bills found
- A **searchable, sortable table** with all bill details

<image of results table with stats cards>

| Column | Description |
|--------|-------------|
| EWB No | eWay Bill number |
| Date | Bill generation date |
| Status | ACT (Active), CNL (Cancelled), etc. |
| From GSTIN | Consignor's GSTIN |
| Consignor | Consignor trade name |
| Origin | Origin place |
| Consignee | Consignee trade name |
| Destination | Destination place |
| Invoice Value | Total invoice amount |
| Valid Upto | Bill validity date |
| Vehicle | Latest vehicle number |

### View Full Details

Click the **expand arrow** on any row to see complete bill information including addresses, transporter details, vehicle history, and item list.

<image of expanded row showing full details>

### Download Excel

Click **Download Excel** to download the shipment report for all displayed bills. The Excel file is generated from the server using the standard shipment template.

<image of Download Excel button>

---

## 5. Add Users (Admin)

Click **Manage Users** in the left sidebar.

<image of empty Manage Users page>

### Create a New User

1. Click **Add User**
2. Fill in the user details:

| Field | Description |
|-------|-------------|
| **Name** | Display name for the user |
| **Email** | Login email (must be unique) |
| **Password** | Login password |

<image of Add User dialog - user details section>

3. **Select State Codes** - Choose which states this user can query. Only states from your admin configuration are available.

<image of state code chips in Add User dialog>

4. **Add eWay Bill Filters** - Define which bills this user can see. Each filter row has three fields:

| Filter Field | Description | Example |
|-------------|-------------|---------|
| **From GSTIN** | Consignor's GSTIN | `24ABICS2160H1ZH` |
| **Origin Place** | Origin place name | `ANKLESHWAR` |
| **Consignor Trade Name** | Consignor company name | `SIAM CEMENT BIG BLOC CONSTRUCTION TECHNOLOGIES PVT LTD.` |

Click **Add Filter** to add more filter rows. A bill is shown to the user if it matches **any** of the filter rows.

<image of filter rows in Add User dialog>

**Example:** For a user handling Ankleshwar operations:

| From GSTIN | Origin Place | Consignor Trade Name |
|-----------|-------------|---------------------|
| `24ABICS2160H1ZH` | `ANKLESHWAR` | `SIAM CEMENT BIG BLOC CONSTRUCTION TECHNOLOGIES PVT LTD.` |
| `33AABCS4338M1Z8` | `ANKLESHWAR` | `SAINT GOBAIN INDIA PVT LTD (CHENNAI)` |

5. Click **Create User**

<image of completed Add User dialog before saving>

### Edit or Delete Users

- Click the **pencil icon** to edit a user's name, state codes, or filters
- Click the **trash icon** to delete a user

<image of user list with edit/delete icons>

---

## 6. What a Sub-User Sees

When a sub-user logs in, they see a simplified interface:

- **No** eWay Authentication page (admin only)
- **No** State Codes page (admin only)
- **No** Manage Users page (admin only)
- **Only** the **Fetch Bills** page

<image of sub-user sidebar showing only Fetch Bills>

The sub-user's configured GSTIN, state codes, and active filter count are shown at the top.

<image of sub-user Fetch Bills header showing filters active>

When the sub-user fetches bills:
1. Bills are fetched for the **state codes assigned to them** by the admin
2. Results are **automatically filtered** to show only bills matching their assigned filters (From GSTIN + Origin Place + Consignor Trade Name)
3. The **Download Excel** contains only their filtered bills

<image of sub-user results showing filtered bills>

> **Note:** Sub-users cannot change their own GSTIN, state codes, or filters. Only the admin can modify these settings.

---

## Quick Reference

| Task | Who Can Do It | Where |
|------|--------------|-------|
| Login | Everyone | `/login` |
| Authenticate eWay GSTIN | Admin | Sidebar > eWay Authentication |
| Configure state codes | Admin | Sidebar > State Codes |
| Fetch & view bills | Everyone | Sidebar > Fetch Bills |
| Download Excel report | Everyone | Fetch Bills > Download Excel |
| Add/edit/delete users | Admin | Sidebar > Manage Users |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Fetch Bills button is grayed out | GSTIN or state codes not configured. Admin must set up eWay Authentication and State Codes first. |
| "Could not retrieve transporter data by GSTIN" warning | The GSTIN is not registered as a transporter in that state. This is normal for states where you have no active bills. |
| "Token Expired" error | Go to eWay Authentication and re-authenticate with your credentials. |
| No bills found | Verify the date is correct. Bills generated today may not be available until the next day. |
| Sub-user sees 0 bills after filter | Check if the filter values (GSTIN, Place, Trade Name) exactly match the bill data. Filters are case-insensitive but must match the full value. |
