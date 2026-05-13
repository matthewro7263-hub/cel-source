# cel-source

An animation production hub.

## Tech Stack

### Client
*   **Vite**: Fast frontend build tool.
*   **React**: UI library.
*   **TanStack Query**: Data fetching and state management.
*   **Wouter**: Minimalist routing.
*   **Radix UI**: Unstyled accessible components.
*   **Tailwind CSS**: Utility-first CSS framework.

### Server
*   **Express**: Node.js web framework.
*   **Drizzle ORM**: TypeScript ORM.
*   **Postgres (Neon)**: Serverless Postgres database.
*   **Cloudflare R2**: S3-compatible object storage for assets.

## Directory Layout

*   `client/src/`
    *   `components/`: Reusable UI components (including Radix primitives).
    *   `pages/`: Top-level route components.
    *   `lib/`: Client-side utilities.
    *   `hooks/`: Custom React hooks.
*   `server/`: Express backend application and API routes.
*   `shared/`: Shared TypeScript types and Drizzle schemas.
*   `docs/`: Additional documentation.

## Local Dev Setup

1.  **Environment Variables**: Create a `.env` file based on `.env.example`.
    *   `DATABASE_URL`: Connection string for your Postgres/Neon database.
    *   `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`: Credentials for Cloudflare R2.
    *   `PORT_5000_`: The application server typically listens on port 5000 (set via environment variables).
2.  **Auth Notes**: Session management requires `SESSION_SECRET` to be set in the `.env` file. Secure password hashing uses `scrypt`.
3.  **Install Dependencies**: Use `pnpm install` (do not use `npm` or `yarn`).

## npm Scripts (via pnpm)

*   `pnpm run dev`: Starts the development server using `tsx`.
*   `pnpm run build`: Builds both the client and server using Vite and `tsx`.
*   `pnpm run start`: Starts the compiled production server.
*   `pnpm run check`: Runs TypeScript type checking (`tsc`).
*   `pnpm run db:push`: Pushes schema changes to the database using `drizzle-kit`.

## Deployment

*   **Web Service**: Deployed on **Render** as a web service.
*   **Database**: Uses **Neon** for a serverless Postgres database.
*   **Storage**: Assets are stored in **Cloudflare R2**.

## Testing, Linting, and Typechecking

*   **Typechecking**: Run `pnpm check` to validate TypeScript types. This is required before creating a pull request.
*   **Testing**: Unit tests (files ending in `.test.ts`) are executed using `node --experimental-strip-types <test-file>`. They use `node:assert/strict`.
*   **Linting**: Standard `lint` and `test` scripts are not currently defined in `package.json`, rely on `pnpm check`.

## Contributing

### Radix Select Sentinel Pattern

When working with Radix UI `Select` components, they do not accept an empty string (`""`) as a valid value. To handle optional selections or "clear" states, use the **sentinel pattern**:

1.  Use a sentinel string like `'all'` or `'none'` for the "empty" or default option.
2.  When updating the component state, check for this sentinel value and map it back to an empty string (`""`) or `undefined`.

Example:
```tsx
<Select
  value={value || "all"}
  onValueChange={(val) => {
    // Map "all" back to empty string in state
    setValue(val === "all" ? "" : val);
  }}
>
  <SelectTrigger>
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All</SelectItem>
    <SelectItem value="option-1">Option 1</SelectItem>
  </SelectContent>
</Select>
```
