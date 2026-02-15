# Tody 

> **The human-centric to-do list that respects your psychology.**

<div align="center">
  <img src="T DY.jpg" alt="Tody Logo" width="200"/>
</div>

Tody is not just another checklist. It's a premium, gesture-driven task manager built effectively for the way your brain actually works. By combining subtle haptics, adaptive interfaces, and "calm" design principles, Tody helps you flow through your day without the anxiety typical of productivity tools.

---

## ✨ Philosophy & Key Features

Tody is designed around *reducing friction* and *cognitive load*.

### 🧠 Human-Centric Design
*   **Magnetic Deadline Snapping:** Time pickers that "snap" to logical times (9:00 AM, 5:00 PM) with satisfying haptic feedback, because nobody actually means "4:43 PM".
*   **The Today Line:** A persistent, sticky horizon line that physically separates "Now" from "Later".
*   **Pull-to-Focus:** Overwhelmed? Just pull down on your list to enter a distraction-free mode showing only your top 3 tasks.
*   **Swipe Action Memory:** The app learns which swipe actions you use most and reorders them to build muscle memory.
*   **Contextual Empty States:** Instead of blank screens, Tody offers helpful suggestions on what to do next based on the context.

### ⚡ Power User Workflow
*   **Smart Keyboard Toolbar:** Context-aware keys appear above your keyboard. Typing a time? You get "+1hr" buttons. Typing a title? You get priority tags.
*   **Long-Press Preview:** Peek at full task details without opening the edit screen—perfect for skimming.
*   **Batch Mode:** Instantly turn your list into a multi-select interface for rapid cleanup.
*   **Process Inbox:** A dedicated GTD-style mode to rapidly triage new thoughts into actionable tasks.
*   **Reality Score:** (Experimental) A metric that helps you understand how realistic your planning is based on completion history.

### 🎨 Premium Feel
*   **Zero-State Onboarding:** No blank canvas paralysis. Start with "Work Day", "Personal Goals", or "Weekly Habits" templates.
*   **Undo Toasts:** specific, gesture-based undo actions that let you play fast and loose with your list, knowing you have a safety net.

---

## 🛠 Tech Stack

**Mobile (React Native)**
*   **Core:** React Native 0.84 (New Architecture), React 19, TypeScript
*   **Performance:** `react-native-reanimated` (v4), `@shopify/flash-list`
*   **DX/UX:** `react-native-gesture-handler`, `react-native-haptic-feedback`
*   **Navigation:** React Navigation v7
*   **Data:** Supabase JS Client, AsyncStorage

**Backend (Hybrid)**
*   **Database:** Supabase (PostgreSQL) with Row Level Security.
*   **Server:** Python FastAPI (located in `/server`).
    *   Used for complex business logic, analytics, and "Reality Score" calculations.
    *   Proxies specific requests to Supabase or handles background jobs.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js >= 22
*   Ruby (for CocoaPods)
*   Python 3.10+ (for backend)
*   Xcode (iOS) or Android Studio (Android)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/tody.git
    cd tody
    ```

2.  **Install JS dependencies**
    ```bash
    npm install
    ```

3.  **Install iOS dependencies**
    ```bash
    cd ios && pod install && cd ..
    ```

4.  **Setup Environment Variables**
    *   Create a `.env` file in the root directory (refer to `.env.example` if available) or configure `src/lib/supabase.ts` with your Supabase credentials.

### Running the App

*   **iOS:**
    ```bash
    npm run ios
    ```

*   **Android:**
    ```bash
    npm run android
    ```

### Running the Backend Server
The Python server is optional for basic CRUD but required for advanced features.

```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## 📂 Project Structure

```
Tody/
├── src/
│   ├── components/      # UI atoms (FocusOrb, DeadlineSnapper, etc.)
│   ├── context/         # React Context (Auth, Theme, Inbox)
│   ├── lib/             # Supabase clients and sync logic
│   ├── navigation/      # RootNavigator and stack config
│   ├── screens/         # Full screen views (Home, Profile, Archive)
│   ├── types/           # TS interfaces
│   └── utils/           # Helper functions
├── server/              # Python FastAPI backend
│   ├── routers/         # API endpoints
│   └── main.py          # Entry point
├── android/             # Native Android code
├── ios/                 # Native iOS code
└── supabase/            # SQL schemas and backups
```

---

## 🤝 Contributing

We welcome contributions that align with our "calm computing" philosophy.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
