'use client';

// EXAMPLE: Ark UI headless components
// All components are unstyled — apply Tailwind classes directly on the parts
// data-[state=open], data-[highlighted], data-[selected] etc. for state-based styling

import { Accordion } from '@ark-ui/react/accordion';
import { Dialog } from '@ark-ui/react/dialog';
import { createListCollection, Select } from '@ark-ui/react/select';
import { Switch } from '@ark-ui/react/switch';
import { Tabs } from '@ark-ui/react/tabs';
import { Tooltip } from '@ark-ui/react/tooltip';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { ColorModeToggle } from '@/features/color-mode';

const frameworks = createListCollection({
  items: [
    { label: 'Next.js', value: 'nextjs' },
    { label: 'Remix', value: 'remix' },
    { label: 'Astro', value: 'astro' },
  ],
});

export default function ArkUIExamplePage() {
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ark UI Examples</h1>
          <p className="text-muted-foreground mt-1">
            Headless components — styled with plain Tailwind.
          </p>
        </div>
        <ColorModeToggle />
      </div>

      {/* Tabs */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Tabs
        </h2>
        <Tabs.Root defaultValue="overview">
          <Tabs.List className="flex border-b gap-1">
            {['overview', 'settings', 'billing'].map((tab) => (
              <Tabs.Trigger
                key={tab}
                value={tab}
                className="px-4 py-2 text-sm font-medium capitalize text-muted-foreground border-b-2 border-transparent data-[selected]:border-primary data-[selected]:text-foreground transition-colors hover:text-foreground"
              >
                {tab}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content
            value="overview"
            className="pt-4 text-sm text-muted-foreground"
          >
            Overview content goes here.
          </Tabs.Content>
          <Tabs.Content
            value="settings"
            className="pt-4 text-sm text-muted-foreground"
          >
            Settings content goes here.
          </Tabs.Content>
          <Tabs.Content
            value="billing"
            className="pt-4 text-sm text-muted-foreground"
          >
            Billing content goes here.
          </Tabs.Content>
        </Tabs.Root>
      </section>

      {/* Select */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Select
        </h2>
        <Select.Root collection={frameworks} positioning={{ sameWidth: true }}>
          <Select.Label className="text-sm font-medium">Framework</Select.Label>
          <Select.Control>
            <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <Select.ValueText placeholder="Select a framework" />
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Select.Trigger>
          </Select.Control>
          <Select.Positioner>
            <Select.Content className="z-50 rounded-md border bg-popover shadow-md overflow-hidden">
              {frameworks.items.map((item) => (
                <Select.Item
                  key={item.value}
                  item={item}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <Select.ItemIndicator>
                    <Check className="h-4 w-4" />
                  </Select.ItemIndicator>
                  <Select.ItemText>{item.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Select.Root>
      </section>

      {/* Accordion */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Accordion
        </h2>
        <Accordion.Root collapsible className="rounded-md border divide-y">
          {[
            {
              value: 'q1',
              title: 'What is Ark UI?',
              body: 'A headless component library built on Zag.js state machines. Fully accessible, unstyled, framework-agnostic.',
            },
            {
              value: 'q2',
              title: 'Why no pre-built styles?',
              body: 'You bring your own styling system — Tailwind, CSS Modules, CSS-in-JS. No specificity battles.',
            },
            {
              value: 'q3',
              title: 'Does it support SSR?',
              body: 'Yes. All components work in Next.js App Router and server-side rendering environments.',
            },
          ].map(({ value, title, body }) => (
            <Accordion.Item key={value} value={value}>
              <Accordion.ItemTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors">
                {title}
                <Accordion.ItemIndicator>
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-90" />
                </Accordion.ItemIndicator>
              </Accordion.ItemTrigger>
              <Accordion.ItemContent className="overflow-hidden text-sm text-muted-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                <p className="px-4 pb-3">{body}</p>
              </Accordion.ItemContent>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </section>

      {/* Switch + Tooltip */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Switch + Tooltip
        </h2>
        <div className="flex items-center gap-4">
          <Switch.Root
            checked={notifications}
            onCheckedChange={(e) => setNotifications(e.checked)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Switch.Control className="relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent bg-input transition-colors data-[state=checked]:bg-primary">
              <Switch.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5" />
            </Switch.Control>
            <Switch.Label className="text-sm font-medium">
              Notifications
            </Switch.Label>
          </Switch.Root>

          <Tooltip.Root openDelay={200}>
            <Tooltip.Trigger className="text-sm text-muted-foreground underline underline-offset-2 cursor-help">
              What's this?
            </Tooltip.Trigger>
            <Tooltip.Positioner>
              <Tooltip.Content className="z-50 rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
                Toggle email and push notifications for your account.
              </Tooltip.Content>
            </Tooltip.Positioner>
          </Tooltip.Root>
        </div>
      </section>

      {/* Dialog */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Dialog
        </h2>
        <Dialog.Root>
          <Dialog.Trigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-10 px-4 hover:bg-primary/90 transition-colors">
            Open Dialog
          </Dialog.Trigger>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Dialog.Content className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-lg font-semibold">
                  Confirm action
                </Dialog.Title>
                <Dialog.CloseTrigger className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
                  <X className="h-4 w-4" />
                </Dialog.CloseTrigger>
              </div>
              <Dialog.Description className="text-sm text-muted-foreground mb-6">
                This action cannot be undone. Are you sure you want to continue?
              </Dialog.Description>
              <div className="flex justify-end gap-3">
                <Dialog.CloseTrigger className="inline-flex items-center justify-center rounded-md border text-sm font-medium h-10 px-4 hover:bg-accent transition-colors">
                  Cancel
                </Dialog.CloseTrigger>
                <Dialog.CloseTrigger className="inline-flex items-center justify-center rounded-md bg-destructive text-white text-sm font-medium h-10 px-4 hover:bg-destructive/90 transition-colors">
                  Continue
                </Dialog.CloseTrigger>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      </section>
    </div>
  );
}
