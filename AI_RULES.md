# AI Rules for Elephant Dental Application

This document outlines the technical stack and specific library usage guidelines for the Elephant Dental application. Adhering to these rules ensures consistency, maintainability, and leverages the strengths of our chosen technologies.

## Tech Stack Overview

*   **Vite**: The build tool for a fast development experience and optimized production builds.
*   **TypeScript**: The primary language for all application code, providing type safety and improved developer experience.
*   **React**: The core JavaScript library for building user interfaces.
*   **shadcn/ui**: A collection of reusable UI components, built on Radix UI and styled with Tailwind CSS.
*   **Tailwind CSS**: The utility-first CSS framework used for all styling.
*   **React Router**: Used for declarative routing within the application.
*   **Supabase**: Our backend-as-a-service, handling authentication, database, and real-time subscriptions.
*   **Tanstack Query**: For efficient server state management and data fetching.
*   **Lucide React**: A library providing a consistent set of SVG icons.
*   **Zod**: A TypeScript-first schema declaration and validation library, often used with forms.
*   **React Hook Form**: A performant, flexible, and extensible form library for React.
*   **Sonner**: A modern toast component for displaying notifications.
*   **date-fns**: A comprehensive and consistent toolset for manipulating JavaScript dates.

## Library Usage Rules

To maintain a consistent and efficient codebase, please follow these guidelines for library usage:

*   **UI Components**:
    *   **Always** prioritize `shadcn/ui` components for all UI elements.
    *   If a specific `shadcn/ui` component is not available or requires significant modification, create a **new component** in `src/components/` and style it using Tailwind CSS. **Do not modify existing `shadcn/ui` component files directly.**
*   **Styling**:
    *   **Exclusively** use Tailwind CSS for all component styling. Avoid writing custom CSS classes unless absolutely necessary for global styles in `src/index.css`.
    *   Utilize the `cn` utility function from `src/lib/utils.ts` for conditionally combining Tailwind classes.
*   **Routing**:
    *   Use `react-router-dom` for all client-side navigation and route definitions.
    *   All main application routes should be defined in `src/App.tsx`.
*   **Backend & Authentication**:
    *   All interactions with the backend, including user authentication, database queries, and real-time features, **must** use the `supabase` client configured in `src/integrations/supabase/client.ts`.
*   **Data Fetching**:
    *   Use `Tanstack Query` for managing server state, caching, and asynchronous data fetching.
*   **Forms**:
    *   Implement all forms using `react-hook-form` for state management and validation.
    *   For schema validation, integrate `zod` with `react-hook-form` using `@hookform/resolvers`.
*   **Icons**:
    *   Use icons from the `lucide-react` library.
*   **Notifications**:
    *   For displaying user feedback and notifications, use the `sonner` toast component.
*   **Date Manipulation**:
    *   When working with dates, use functions provided by `date-fns`.
*   **File Structure**:
    *   New components should be placed in `src/components/`.
    *   New pages should be placed in `src/pages/`.
    *   Admin-specific pages should be nested under `src/pages/admin/`.
    *   Utility functions should reside in `src/lib/utils.ts` or a new, appropriately named `src/utils/` file if they form a cohesive set.
*   **Responsiveness**:
    *   All new UI should be designed with responsiveness in mind, utilizing Tailwind's responsive utility classes.