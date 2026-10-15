# Insightly Docs — frontend

React 19 + Vite + TypeScript.

```bash
npm install
cp .env.example .env   # VITE_API_URL, optional VITE_SALES_EMAIL
npm run dev
```

## Structure

```
src/
  api/          ragApi.ts (all HTTP calls)
  config/       plans.ts (plans, prices, yearly discount), features.ts (flags)
  context/      SubscriptionContext/Provider (placeholder until Stripe + auth)
  hooks/        useRagMode (plan gate for Graph), useConversations, useTheme, useDismiss, useSubscription
  lib/          pricing.ts (price/date formatting)
  types/        shared types
  components/
    ui/         Icons, ThemeToggle, toast/
    chat/       ChatBox, Composer, MessageList, ChatEmptyState, IndexingProgress
    sidebar/    Sidebar, ConversationList/Item, DocumentList
    user-menu/  UserMenu, SearchModeSwitch
    billing/    PlanCard, BillingToggle, FaqAccordion
  pages/        BillingPage
  styles/       one CSS file per area, imported from App.css (tokens in index.css)
```

## To wire up later
- Stripe Checkout in `App.handleSelectPlan` (card up front, trial billed at its end).
- Auth (Google OAuth2) → replace the guest user and hydrate `SubscriptionProvider`.
- Conversation rename/delete: add `PATCH/DELETE /sessions/:id` then set `FEATURES.manageConversations = true`.
- Plan quotas in `config/plans.ts` are placeholders.
