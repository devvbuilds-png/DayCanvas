# DayCanvas

A daily planner fused with an infinite whiteboard: think on the canvas, then drag your thoughts onto the timeline.

**Live:** [day-canvas-nu.vercel.app](https://day-canvas-nu.vercel.app)

## What it is / why I built it

My planning used to be split between two places: a messy whiteboard or notebook where ideas come out, and a to-do list or calendar where they are supposed to end up. Copying from one to the other is where tasks get lost.

DayCanvas puts both on one page. The top half is a day timeline with colour-coded lanes and a parking lot for unscheduled tasks. Scroll down and you get a full tldraw whiteboard. Write a text note on the board, drag it up onto a lane, and it becomes a scheduled to-do at that time. At the end of the day you "stamp" it and decide what happens to anything left unfinished.

## Features

- **Timeline lanes**: 6am to midnight timeline split into colour-coded lanes (add, rename, delete and drag to reorder)
- **Parking lot**: unscheduled to-dos waiting to be placed
- **Drag-to-schedule**: drag a task from the parking lot onto a lane; it snaps to 30-minute slots, and you can drag it back to unschedule
- **Resizable pills**: change a task's start time and duration directly on the timeline
- **Whiteboard-to-todo**: drag a text shape from the tldraw canvas onto a lane to schedule it, or onto the parking lot and pick a lane
- **Gesture marking**: hold Shift (or toggle gesture mode) and draw on a task: a tick or strike-through marks it done, a cross marks it missed, a digit 1-9 sets priority. Undo is available.
- **Detail panel**: edit start/end time and add notes per task
- **Now indicator**: a live red line, plus the current task shown in the header
- **Day mood**: tap to cycle a mood for the day
- **End-of-day stamp**: unresolved tasks get a review sheet where you carry them over, push them to a chosen date, or mark them missed
- **Day navigation**: move between days; each day keeps its own schedule
- **Local-first**: everything is stored in the browser (IndexedDB via Dexie); the whiteboard persists through tldraw's local persistence

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- tldraw (whiteboard)
- @dnd-kit (drag and drop)
- Dexie + dexie-react-hooks (IndexedDB storage)
- Deployed on Vercel

## Run locally

```bash
npm install
cp .env.example .env   # optional: add a tldraw license key
npm run dev
```

Environment variables:
- `VITE_TLDRAW_LICENSE_KEY`: tldraw license key (needed for production deployments)

Other scripts: `npm run build`, `npm run preview`, `npm run lint`.

## Project structure

```
src/
  App.tsx              # layout, drag-and-drop wiring, stamping and gesture state
  components/          # Header, ParkingLot, Timeline, TimelineLane, TimelinePill,
                       # Whiteboard, DetailPanel, StampSheet, LaneManager, TodoGestureOverlay, ...
  db/                  # Dexie database, schema types (Todo, Lane, Day), first-run seed
  lib/                 # time helpers, lane helpers, gesture recognizer (todoGestures.ts)
```

## Status

Working and deployed. Single-user, with data stored only in your browser (no accounts or sync).
