'use client';

// EXAMPLE: Ark UI headless components
// All components are unstyled — apply Panda CSS styles directly on the parts
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
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

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
    <div
      className={css({
        p: '8',
        maxW: '2xl',
        mx: 'auto',
        display: 'flex',
        flexDir: 'column',
        gap: '10',
      })}
    >
      <div className={flex({ align: 'center', justify: 'space-between' })}>
        <div>
          <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>
            Ark UI Examples
          </h1>
          <p className={css({ color: 'muted.foreground', mt: '1' })}>
            Headless components — styled with Panda CSS.
          </p>
        </div>
        <ColorModeToggle />
      </div>

      {/* Tabs */}
      <section
        className={css({ display: 'flex', flexDir: 'column', gap: '3' })}
      >
        <h2
          className={css({
            fontSize: 'sm',
            fontWeight: 'semibold',
            textTransform: 'uppercase',
            letterSpacing: 'wider',
            color: 'muted.foreground',
          })}
        >
          Tabs
        </h2>
        <Tabs.Root defaultValue="overview">
          <Tabs.List className={flex({ borderBottomWidth: '1px', gap: '1' })}>
            {['overview', 'settings', 'billing'].map((tab) => (
              <Tabs.Trigger
                key={tab}
                value={tab}
                className={css({
                  px: '4',
                  py: '2',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  textTransform: 'capitalize',
                  color: 'muted.foreground',
                  borderBottomWidth: '2px',
                  borderColor: 'transparent',
                  cursor: 'pointer',
                  transition: 'colors',
                  _hover: { color: 'foreground' },
                  _selected: { borderColor: 'primary', color: 'foreground' },
                })}
              >
                {tab}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content
            value="overview"
            className={css({
              pt: '4',
              fontSize: 'sm',
              color: 'muted.foreground',
            })}
          >
            Overview content goes here.
          </Tabs.Content>
          <Tabs.Content
            value="settings"
            className={css({
              pt: '4',
              fontSize: 'sm',
              color: 'muted.foreground',
            })}
          >
            Settings content goes here.
          </Tabs.Content>
          <Tabs.Content
            value="billing"
            className={css({
              pt: '4',
              fontSize: 'sm',
              color: 'muted.foreground',
            })}
          >
            Billing content goes here.
          </Tabs.Content>
        </Tabs.Root>
      </section>

      {/* Select */}
      <section
        className={css({ display: 'flex', flexDir: 'column', gap: '3' })}
      >
        <h2
          className={css({
            fontSize: 'sm',
            fontWeight: 'semibold',
            textTransform: 'uppercase',
            letterSpacing: 'wider',
            color: 'muted.foreground',
          })}
        >
          Select
        </h2>
        <Select.Root collection={frameworks} positioning={{ sameWidth: true }}>
          <Select.Label
            className={css({ fontSize: 'sm', fontWeight: 'medium' })}
          >
            Framework
          </Select.Label>
          <Select.Control>
            <Select.Trigger
              className={flex({
                h: '10',
                w: 'full',
                align: 'center',
                justify: 'space-between',
                rounded: 'md',
                borderWidth: '1px',
                borderColor: 'input',
                bg: 'background',
                px: '3',
                py: '2',
                fontSize: 'sm',
                cursor: 'pointer',
                _focus: {
                  outline: 'none',
                  ring: '2px solid',
                  ringColor: 'ring',
                },
              })}
            >
              <Select.ValueText placeholder="Select a framework" />
              <ChevronDown className={css({ h: '4', w: '4', opacity: 0.5 })} />
            </Select.Trigger>
          </Select.Control>
          <Select.Positioner>
            <Select.Content
              className={css({
                zIndex: 50,
                rounded: 'md',
                borderWidth: '1px',
                bg: 'popover',
                shadow: 'md',
                overflow: 'hidden',
              })}
            >
              {frameworks.items.map((item) => (
                <Select.Item
                  key={item.value}
                  item={item}
                  className={flex({
                    cursor: 'pointer',
                    align: 'center',
                    gap: '2',
                    px: '3',
                    py: '2',
                    fontSize: 'sm',
                    _highlighted: { bg: 'accent', color: 'accent.foreground' },
                  })}
                >
                  <Select.ItemIndicator>
                    <Check className={css({ h: '4', w: '4' })} />
                  </Select.ItemIndicator>
                  <Select.ItemText>{item.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Select.Root>
      </section>

      {/* Accordion */}
      <section
        className={css({ display: 'flex', flexDir: 'column', gap: '3' })}
      >
        <h2
          className={css({
            fontSize: 'sm',
            fontWeight: 'semibold',
            textTransform: 'uppercase',
            letterSpacing: 'wider',
            color: 'muted.foreground',
          })}
        >
          Accordion
        </h2>
        <Accordion.Root
          collapsible
          className={css({ rounded: 'md', borderWidth: '1px', divideY: '1px' })}
        >
          {[
            {
              value: 'q1',
              title: 'What is Ark UI?',
              body: 'A headless component library built on Zag.js state machines. Fully accessible, unstyled, framework-agnostic.',
            },
            {
              value: 'q2',
              title: 'Why no pre-built styles?',
              body: 'You bring your own styling system — Panda CSS, CSS Modules, CSS-in-JS. No specificity battles.',
            },
            {
              value: 'q3',
              title: 'Does it support SSR?',
              body: 'Yes. All components work in Next.js App Router and server-side rendering environments.',
            },
          ].map(({ value, title, body }) => (
            <Accordion.Item key={value} value={value}>
              <Accordion.ItemTrigger
                className={flex({
                  w: 'full',
                  align: 'center',
                  justify: 'space-between',
                  px: '4',
                  py: '3',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  transition: 'colors',
                  _hover: { bg: 'accent/50' },
                })}
              >
                {title}
                <Accordion.ItemIndicator>
                  <ChevronRight
                    className={css({
                      h: '4',
                      w: '4',
                      transition: 'transform',
                      transitionDuration: '200ms',
                      _open: { transform: 'rotate(90deg)' },
                    })}
                  />
                </Accordion.ItemIndicator>
              </Accordion.ItemTrigger>
              <Accordion.ItemContent
                className={css({
                  overflow: 'hidden',
                  fontSize: 'sm',
                  color: 'muted.foreground',
                  _open: { animation: 'fadeIn 0.2s ease-out' },
                  _closed: { animation: 'fadeOut 0.15s ease-in' },
                })}
              >
                <p className={css({ px: '4', pb: '3' })}>{body}</p>
              </Accordion.ItemContent>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </section>

      {/* Switch + Tooltip */}
      <section
        className={css({ display: 'flex', flexDir: 'column', gap: '3' })}
      >
        <h2
          className={css({
            fontSize: 'sm',
            fontWeight: 'semibold',
            textTransform: 'uppercase',
            letterSpacing: 'wider',
            color: 'muted.foreground',
          })}
        >
          Switch + Tooltip
        </h2>
        <div className={flex({ align: 'center', gap: '4' })}>
          <Switch.Root
            checked={notifications}
            onCheckedChange={(e) => setNotifications(e.checked)}
            className={flex({ align: 'center', gap: '2', cursor: 'pointer' })}
          >
            <Switch.Control
              className={css({
                position: 'relative',
                display: 'inline-flex',
                h: '6',
                w: '11',
                alignItems: 'center',
                rounded: 'full',
                borderWidth: '2px',
                borderColor: 'transparent',
                bg: 'input',
                transition: 'colors',
                _checked: { bg: 'primary' },
              })}
            >
              <Switch.Thumb
                className={css({
                  pointerEvents: 'none',
                  display: 'block',
                  h: '4',
                  w: '4',
                  rounded: 'full',
                  bg: 'white',
                  shadow: 'lg',
                  transition: 'transform',
                  _checked: { transform: 'translateX(20px)' },
                  _unchecked: { transform: 'translateX(2px)' },
                })}
              />
            </Switch.Control>
            <Switch.Label
              className={css({ fontSize: 'sm', fontWeight: 'medium' })}
            >
              Notifications
            </Switch.Label>
          </Switch.Root>

          <Tooltip.Root openDelay={200}>
            <Tooltip.Trigger
              className={css({
                fontSize: 'sm',
                color: 'muted.foreground',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                cursor: 'help',
              })}
            >
              What&apos;s this?
            </Tooltip.Trigger>
            <Tooltip.Positioner>
              <Tooltip.Content
                className={css({
                  zIndex: 50,
                  rounded: 'md',
                  bg: 'popover',
                  px: '3',
                  py: '1.5',
                  fontSize: 'sm',
                  color: 'popover.foreground',
                  shadow: 'md',
                  _open: { animation: 'fadeIn 0.15s ease-out' },
                })}
              >
                Toggle email and push notifications for your account.
              </Tooltip.Content>
            </Tooltip.Positioner>
          </Tooltip.Root>
        </div>
      </section>

      {/* Dialog */}
      <section
        className={css({ display: 'flex', flexDir: 'column', gap: '3' })}
      >
        <h2
          className={css({
            fontSize: 'sm',
            fontWeight: 'semibold',
            textTransform: 'uppercase',
            letterSpacing: 'wider',
            color: 'muted.foreground',
          })}
        >
          Dialog
        </h2>
        <Dialog.Root>
          <Dialog.Trigger
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              rounded: 'md',
              bg: 'primary',
              color: 'primary.foreground',
              fontSize: 'sm',
              fontWeight: 'medium',
              h: '10',
              px: '4',
              cursor: 'pointer',
              transition: 'colors',
              _hover: { opacity: 0.9 },
            })}
          >
            Open Dialog
          </Dialog.Trigger>
          <Dialog.Backdrop
            className={css({
              position: 'fixed',
              inset: '0',
              zIndex: 50,
              bg: 'black/50',
              _open: { animation: 'fadeIn 0.2s ease-out' },
              _closed: { animation: 'fadeOut 0.15s ease-in' },
            })}
          />
          <Dialog.Positioner
            className={css({
              position: 'fixed',
              inset: '0',
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: '4',
            })}
          >
            <Dialog.Content
              className={css({
                w: 'full',
                maxW: 'md',
                rounded: 'lg',
                bg: 'background',
                p: '6',
                shadow: 'lg',
                _open: {
                  animation: 'fadeIn 0.2s ease-out, zoomIn 0.2s ease-out',
                },
                _closed: {
                  animation: 'fadeOut 0.15s ease-in, zoomOut 0.15s ease-in',
                },
              })}
            >
              <div
                className={flex({
                  align: 'center',
                  justify: 'space-between',
                  mb: '4',
                })}
              >
                <Dialog.Title
                  className={css({ fontSize: 'lg', fontWeight: 'semibold' })}
                >
                  Confirm action
                </Dialog.Title>
                <Dialog.CloseTrigger
                  className={css({
                    rounded: 'sm',
                    opacity: 0.7,
                    cursor: 'pointer',
                    transition: 'opacity',
                    _hover: { opacity: 1 },
                  })}
                >
                  <X className={css({ h: '4', w: '4' })} />
                </Dialog.CloseTrigger>
              </div>
              <Dialog.Description
                className={css({
                  fontSize: 'sm',
                  color: 'muted.foreground',
                  mb: '6',
                })}
              >
                This action cannot be undone. Are you sure you want to continue?
              </Dialog.Description>
              <div className={flex({ justify: 'flex-end', gap: '3' })}>
                <Dialog.CloseTrigger
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    rounded: 'md',
                    borderWidth: '1px',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    h: '10',
                    px: '4',
                    cursor: 'pointer',
                    transition: 'colors',
                    _hover: { bg: 'accent' },
                  })}
                >
                  Cancel
                </Dialog.CloseTrigger>
                <Dialog.CloseTrigger
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    rounded: 'md',
                    bg: 'destructive',
                    color: 'white',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    h: '10',
                    px: '4',
                    cursor: 'pointer',
                    transition: 'colors',
                    _hover: { opacity: 0.9 },
                  })}
                >
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
