# Brick Factory Project Overview

## Description
Brick Factory is an interactive, web-based calculator and 3D visualization tool designed for estimating brick quantities and construction costs. It allows users to input dimensions for various structures (like single walls, rooms, or bathrooms) and add openings such as doors, windows, and ventilators. The application not only calculates the total required bricks and mortar but also generates an instant, interactive 3D preview of the structure, providing a realistic visualization of the final build.

## Key Features
- **Advanced Calculator Engine**: Calculates total bricks required, mortar volume, and cost estimates based on user-defined wall dimensions and brick types.
- **Dynamic 3D Structure Preview**: An interactive 3D canvas that renders the walls, bricks, and custom openings (doors/windows) in real-time. Includes wireframe mode and view presets (Iso, Front, Top, etc.).
- **Room & Opening Management**: Supports multi-wall rooms with precise mapping for doors and windows (Front, Right, Back, Left walls), including custom positioning and offsets.
- **Responsive & Modern UI**: Built with a sleek, interactive user interface utilizing smooth scrolling and animated components.

---

## Tech Stack

### Core Frameworks
- **[Next.js](https://nextjs.org/) (v16.3.1)**: The core React framework handling routing, server-side rendering, and project architecture.
- **[React](https://react.dev/) (v19.2.8)**: The foundational UI library used for building interactive components and managing state.
- **[TypeScript](https://www.typescriptlang.org/)**: Strongly typed JavaScript to ensure codebase reliability, maintainability, and fewer runtime errors.

### 3D Rendering & Visualization
- **[Three.js](https://threejs.org/)**: The underlying WebGL graphics engine used for high-performance 3D rendering.
- **[React Three Fiber (R3F)](https://docs.pmnd.rs/react-three-fiber)**: A React wrapper for Three.js that allows declarative 3D scene construction using React components. Leverages `InstancedMesh` for rendering thousands of bricks efficiently.
- **[@react-three/drei](https://github.com/pmndrs/drei)**: A collection of useful helpers for R3F, used for camera controls (`OrbitControls`), realistic shadows (`ContactShadows`), centering (`Center`), and HTML overlays (`Html`).

### Styling & UI
- **[Tailwind CSS](https://tailwindcss.com/) (v4)**: Utility-first CSS framework for rapid, responsive UI development.
- **[Framer Motion](https://www.framer.com/motion/)**: An animation library used to create smooth, physics-based UI transitions.
- **[Lucide React](https://lucide.dev/)**: A modern, clean icon library.
- **[Lenis](https://studiofreight.github.io/lenis/)**: A lightweight smooth scrolling library used to enhance the scrolling experience throughout the application.

### Database & Backend
- **[Prisma](https://www.prisma.io/)**: Next-generation Node.js and TypeScript ORM for database modeling and migrations (prepared for backend integration).

### Utilities
- **clsx** & **tailwind-merge**: Used for dynamic and conditional tailwind class management.
