# FoodLink AI — Frontend Prototype

> **Turning Surplus Food Into Community Impact**

An AI-assisted community food redistribution platform connecting surplus food from college campuses with organizations that need it.

---

## 🚀 Quick Start

```bash
cd frontend
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173)

---

## 📸 Demo Flow (Professor Presentation)

1. **Landing Page** `/` — Overview of FoodLink AI, stats, how it works, roles, and AI match preview
2. **Login** `/login` — Select role (Donor / Recipient / Volunteer / Admin) and enter dashboard
3. **Create Donation** `/donor/create` — Fill form, submit → donation appears in Donor Dashboard
4. **NGO Dashboard** `/ngo` or `/ngo/available` — New donation appears with 94% AI match score
5. **Accept Donation** — Status changes from MATCHED → ACCEPTED
6. **Volunteer Tasks** `/volunteer/tasks` — Accepted task appears
7. **Accept Pickup** → **Mark Picked Up** → **Mark Delivered** — Status flows through to COMPLETED
8. **Admin Dashboard** `/admin` — All stats, activity feed, and donations table reflect changes

---

## 📁 Structure

```
frontend/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── StatCard.tsx
│   │   ├── DonationCard.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── StatusTimeline.tsx
│   │   ├── MatchScore.tsx
│   │   ├── MatchAnalysis.tsx
│   │   ├── MapPreview.tsx
│   │   ├── ToastContainer.tsx
│   │   └── EmptyState.tsx
│   │
│   ├── pages/
│   │   ├── Landing.tsx
│   │   ├── Login.tsx
│   │   ├── donor/
│   │   │   ├── DonorLayout.tsx
│   │   │   ├── DonorDashboard.tsx
│   │   │   ├── DonorDonations.tsx
│   │   │   ├── CreateDonation.tsx
│   │   │   └── DonationDetails.tsx
│   │   ├── ngo/
│   │   │   ├── NGOLayout.tsx
│   │   │   ├── NGODashboard.tsx
│   │   │   └── NGOAvailableDonations.tsx
│   │   ├── volunteer/
│   │   │   ├── VolunteerLayout.tsx
│   │   │   ├── VolunteerDashboard.tsx
│   │   │   ├── VolunteerTasks.tsx
│   │   │   └── TaskCard.tsx
│   │   └── admin/
│   │       ├── AdminLayout.tsx
│   │       └── AdminDashboard.tsx
│   │
│   ├── context/
│   │   └── AppContext.tsx   # Central shared state (useReducer)
│   │
│   ├── data/
│   │   └── mockData.ts     # All mock data + rule-based match scoring
│   │
│   ├── types/
│   │   └── index.ts        # TypeScript interfaces
│   │
│   ├── App.tsx             # React Router setup
│   ├── main.tsx
│   └── index.css
│
└── package.json
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| Icons | Lucide React |
| State | React Context + useReducer |

---

## 📊 Donation Status Machine

```
AVAILABLE → MATCHED → ACCEPTED → VOLUNTEER_ASSIGNED → PICKED_UP → DELIVERED → COMPLETED
                                                                              ↑ also CANCELLED
```

---

## 🤖 AI Matching (Prototype Notes)

The **AI Match Score** is currently computed by a rule-based function in `src/data/mockData.ts` (`computeMockMatchScore`).

To replace it with a real ML model:
1. Replace the body of `computeMockMatchScore` with an API call to the FastAPI ML service
2. The function signature, return type (`MatchAnalysis`), and UI components remain unchanged

---

## 🔮 Deferred to Future Phases

| Feature | Phase |
|---------|-------|
| Real authentication (JWT/FastAPI) | Prototype 2 |
| PostgreSQL database | Prototype 2 |
| FastAPI backend | Prototype 2 |
| ML-based recipient ranking (XGBoost) | Prototype 2 |
| Real-time WebSockets | Prototype 2 |
| Leaflet/OpenStreetMap integration | Prototype 2 |
| AI food image categorization (YOLO) | Advanced |
| NLP donation understanding | Advanced |
| Community surplus/demand heatmap | Advanced |
| Route optimization | Advanced |
| Push notifications | Advanced |

---

## 👨‍💻 Course Info

**UCS503P — Software Engineering**  
Thapar Institute of Engineering & Technology

---

*Prototype 0 — Initial working demonstration*
