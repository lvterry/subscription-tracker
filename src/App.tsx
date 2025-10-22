import { useEffect, useRef, useState } from 'react';
import { Button } from './components/ui/button.jsx';
import { Input } from './components/ui/input.jsx';
import { Label } from './components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select.jsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './components/ui/sheet.jsx';
import { cn } from './lib/utils.js';

const INITIAL_SUBSCRIPTIONS = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    fee: 20,
    cadence: 'Monthly',
    billingDate: '2025-11-16',
  },
  {
    id: 'notion-plus',
    name: 'Notion Plus',
    fee: 10,
    cadence: 'Monthly',
    billingDate: '2025-11-04',
  },
  {
    id: 'linear',
    name: 'Linear',
    fee: 99,
    cadence: 'Monthly',
    billingDate: '2025-12-01',
  },
  {
    id: 'spotify-duo',
    name: 'Spotify Duo',
    fee: 14,
    cadence: 'Monthly',
    billingDate: '2025-10-28',
  },
];

const formatCurrency = (value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return '$0.00';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numeric);
};

const formatDate = (value) => {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const defaultFormValues = {
  name: '',
  fee: '',
  cadence: 'Monthly',
  billingDate: '',
};

const useMediaQuery = (query) => {
  const getMatches = () =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false;

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);

    setMatches(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }

    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }, [query]);

  return matches;
};

function SubscriptionTracker() {
  const [subscriptions, setSubscriptions] = useState(INITIAL_SUBSCRIPTIONS);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [formValues, setFormValues] = useState(defaultFormValues);
  const nameInputRef = useRef(null);
  const isDesktop = useMediaQuery('(min-width: 640px)');

  useEffect(() => {
    if (isPanelOpen) {
      window.requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    }
  }, [isPanelOpen]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedName = formValues.name.trim();

    if (!trimmedName) {
      setFormValues((prev) => ({
        ...prev,
        name: '',
      }));
      nameInputRef.current?.focus();
      return;
    }

    const subscription = {
      id: makeId(),
      name: trimmedName,
      fee: formValues.fee,
      cadence: formValues.cadence,
      billingDate: formValues.billingDate,
    };

    setSubscriptions((prev) => [...prev, subscription]);
    setFormValues(defaultFormValues);
    setIsPanelOpen(false);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Subscription Tracker
          </h1>
          <p className="text-sm text-muted-foreground">
            A quick snapshot of your recurring web services.
          </p>
        </div>
        <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
          <SheetTrigger asChild>
            <Button className="self-start">Add subscription</Button>
          </SheetTrigger>
          <SheetContent
            side={isDesktop ? 'right' : 'bottom'}
            className={cn(
              'w-full sm:max-w-md',
              !isDesktop && 'h-[85vh] rounded-t-xl sm:rounded-xl',
            )}
          >
            <SheetHeader>
              <SheetTitle>Add subscription</SheetTitle>
              <SheetDescription>
                Capture the basics so future invoices never catch you off guard.
              </SheetDescription>
            </SheetHeader>
            <form className="space-y-5 p-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="sub-name">Name</Label>
                <Input
                  id="sub-name"
                  name="name"
                  required
                  value={formValues.name}
                  onChange={handleChange}
                  ref={nameInputRef}
                  placeholder="Service name"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sub-fee">Fee</Label>
                  <Input
                    id="sub-fee"
                    name="fee"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formValues.fee}
                    onChange={handleChange}
                    placeholder="e.g. 12.99"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sub-cadence">Cadence</Label>
                  <Select
                    name="sub-candence"
                    value={formValues.cadence}
                    onValueChange={(value) =>
                      setFormValues((prev) => ({ ...prev, cadence: value }))
                    }
                  >
                    <SelectTrigger id="sub-cadence">
                      <SelectValue placeholder="Select cadence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sub-billing-date">Next billing date</Label>
                <Input
                  id="sub-billing-date"
                  name="billingDate"
                  type="date"
                  required
                  value={formValues.billingDate}
                  onChange={handleChange}
                />
              </div>

              <Button type="submit">Save</Button>
            </form>
          </SheetContent>
        </Sheet>
      </header>

      <section className="space-y-4">
        <div className="divide-y rounded-xl border border-border bg-card/80 shadow-sm backdrop-blur">
          {subscriptions.map((subscription) => (
            <div
              className="flex flex-row gap-2 p-4 items-center justify-between"
              key={subscription.id}
            >
              <div>
                <h3 className="text-lg font-medium">{subscription.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Next billing: {formatDate(subscription.billingDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">
                  {formatCurrency(subscription.fee)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {subscription.cadence}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default SubscriptionTracker;