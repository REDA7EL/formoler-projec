# 🏗️ Backend API Structure — Full Map

> All routes run on `http://localhost:3001`

---

## 🗃️ Database Tables (SQLite)

| Table | What it stores |
|---|---|
| `users` | Login accounts + Team members |
| `customers` | All contacts / customers |
| `campaigns` | Campaign records with stats |
| `settings` | App config (key/value) |
| `activity` | Recent activity log |
| `media` | Uploaded files (image, video, audio) linked to campaigns |

---

## 📄 Page → API Mapping

### 🔐 Login Page
| Method | Route | Action |
|---|---|---|
| `POST` | `/api/login` | Check email + password → returns user info |

---

### 📊 Dashboard
| Method | Route | Action |
|---|---|---|
| `GET` | `/api/dashboard/stats` | Total customers, messages sent, active campaigns |
| `GET` | `/api/dashboard/activity` | Recent activity feed (last 10 events) |
| `GET` | `/api/campaigns` | Recent campaigns table |

---

### 👥 Customers Page
| Method | Route | Action |
|---|---|---|
| `GET` | `/api/customers?search=&status=` | List all customers (with search & filter) |
| `POST` | `/api/customers` | Add new customer |
| `PUT` | `/api/customers/:id` | Edit a customer |
| `DELETE` | `/api/customers/:id` | Delete one customer |
| `DELETE` | `/api/customers` (body: `{ids:[]}`) | Bulk delete selected customers |

---

### 📣 Campaign Manager
| Method | Route | Action |
|---|---|---|
| `GET` | `/api/campaigns?search=&status=` | List all campaigns (with search & filter) |
| `POST` | `/api/campaigns` | Create new campaign |
| `PUT` | `/api/campaigns/:id` | Edit / update campaign |
| `DELETE` | `/api/campaigns/:id` | Delete one campaign |
| `DELETE` | `/api/campaigns` (body: `{ids:[]}`) | Bulk delete selected campaigns |

---

### 📋 Campaign History
| Method | Route | Action |
|---|---|---|
| `GET` | `/api/history/stats` | Total Sent, Avg Open Rate, Click Rate, Failed Delivery |
| `GET` | `/api/campaigns` | Campaign list with stats (openRate, clickRate, etc.) |

---

### 📎 Create Campaign — Media Upload
| Method | Route | Action |
|---|---|---|
| `POST` | `/api/media/upload` | Upload **1 file** (image / video / audio) — form field: `file` |
| `POST` | `/api/media/upload-multiple` | Upload **up to 5 files** at once — form field: `files` |
| `GET` | `/api/media?campaign_id=&type=` | List all media (filter by campaign or type) |
| `DELETE` | `/api/media/:id` | Delete file from disk + database |

**Allowed types:**
- 🖼️ Image: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- 🎬 Video: `video/mp4`, `video/webm`, `video/quicktime`, `video/avi`
- 🎤 Audio: `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/mp4`, `audio/aac`

**Limits:** Max **50 MB** per file

**Storage:** Files saved in `backend/uploads/` — accessible at `http://localhost:3001/uploads/<filename>`

---

### ⚙️ Settings
| Method | Route | Action |
|---|---|---|
| `GET` | `/api/settings` | Load all settings (app name, timezone, API token, etc.) |
| `PUT` | `/api/settings` | Update one setting (body: `{key, value}`) |
| `PUT` | `/api/settings/bulk` | Update multiple settings at once |
| `GET` | `/api/team` | List all team members |
| `POST` | `/api/team` | Add new team member |
| `DELETE` | `/api/team/:id` | Remove team member |

---

## ⚠️ Next Steps

> [!IMPORTANT]
> **Delete the old `database.sqlite` file** before restarting the backend!
> The old file has the old schema. Deleting it forces the backend to create a fresh database with all the new tables.
> 
> **File to delete:** `c:\Users\REDA EL\Downloads\formoler projec\backend\database.sqlite`

> [!NOTE]
> After deleting the database file, run `run.bat` again. The backend will auto-create the database with all tables and seed demo data on first startup.
