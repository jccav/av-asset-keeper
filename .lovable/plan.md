

# AV Equipment Inventory Tracker

A professional inventory management system for an AV department to track equipment checkouts and returns, with a role-based admin system.

---

## 1. Public Equipment Browse & Checkout Page
- **Equipment list** with search, filtering by category (Audio, Video, Lighting, Presentation, Cables/Accessories), and sorting
- Each item shows: name, category, condition (Good/Fair/Damaged), availability status, and notes
- **Sign-out flow**: User clicks "Check Out" on an available item → fills in their name, team name (optional), expected return date, and any notes → confirms checkout
- **Return flow**: User searches for their checked-out item → clicks "Return" → optionally updates condition/notes → confirms return
- Clean, professional design with a neutral color palette and clear status indicators (green = available, red = checked out)

---

## 2. Admin Dashboard (Login Required)
- **Admin login page** — invite-only, no self-registration
- **Inventory management**: Add, edit, and delete equipment items (name, category, condition, notes)
- **Checkout overview**: See all currently checked-out items with who has them, when they were taken, and expected return
- **Full checkout history log**: Searchable/filterable history of all checkouts and returns with timestamps, names, and teams
- **Bulk actions**: Mark items as retired/out of service

---

## 3. Admin Role Management
- **Master Admin** (single user):
  - Can invite new admins via email
  - Can remove admins
  - Can transfer Master Admin role to another existing admin
  - Clearly labeled as "Master Admin" in the admin list
- **Regular Admins**:
  - Full inventory management access (add/edit/delete items)
  - Can view checkout history and current status
  - Can see the list of all admins and who the Master Admin is
  - **Cannot** invite or remove other admins
- Admin list page visible to all admins showing names, roles, and the Master Admin badge

---

## 4. Backend (Lovable Cloud / Supabase)
- **Authentication**: Email-based admin login with invite-only registration
- **Database tables**: Equipment items, checkout/return log, admin users with roles (master_admin, admin)
- **Row-level security**: Admins can manage inventory; public users can only create checkouts/returns
- Equipment categories stored as tags for flexible organization

---

## 5. Key UX Details
- Professional, clean UI with a sidebar for admin navigation
- Responsive design that works on tablets (common in AV environments)
- Toast notifications for successful checkouts, returns, and admin actions
- Dashboard cards showing quick stats: total items, checked out, available, items needing attention (damaged)

