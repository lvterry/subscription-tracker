import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from './components/ui/button.jsx';
import { useAuth } from './contexts/AuthContext';
import { Input } from './components/ui/input.jsx';
import { Label } from './components/ui/label.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './components/ui/alert-dialog.jsx';
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
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './components/ui/sheet.jsx';
import { cn } from './lib/utils.js';
import { ChevronDownIcon, MoreHorizontalIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format } from 'date-fns';
import { seedSubscriptions } from '@/lib/subscription-data';
import {
  loadSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from '@/lib/subscription-service';
import type { BillingCadence, Subscription, SubscriptionFormValues } from '@/types/subscription';

const formatCurrency = (value: string | number) => {
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

const parseDateInput = (value: string | number | Date | null | undefined) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const parts = value.split('-').map(Number);
    if (parts.length === 3 && parts.every((part) => !Number.isNaN(part))) {
      const [year, month, day] = parts;
      const parsed = new Date(year, month - 1, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const formatDate = (value: string | number | Date) => {
  const date = parseDateInput(value);
  if (!date) return value ? String(value) : 'TBD';

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

const defaultFormValues: SubscriptionFormValues = {
  name: '',
  cost: '',
  currency: 'USD',
  billingCycle: 'Monthly',
  nextBillingDate: '',
};

const useMediaQuery = (query: string): boolean => {
  const getMatches = (): boolean =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false;

  const [matches, setMatches] = useState<boolean>(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(query);

    // Ensure correct type for event
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handler);
      return () => {
        mediaQuery.removeEventListener("change", handler);
      };
    } else if (typeof mediaQuery.addListener === "function") {
      // For backward compatibility
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  return matches;
};

function SubscriptionTracker() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(seedSubscriptions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<SubscriptionFormValues>(defaultFormValues);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const isDesktop = useMediaQuery('(min-width: 640px)');

  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date | undefined>(undefined)

  // Load subscriptions from database when user logs in
  useEffect(() => {
    if (!user) {
      // Reset to seed data when logged out
      setSubscriptions(seedSubscriptions);
      setError(null);
      return;
    }

    const fetchSubscriptions = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await loadSubscriptions(user.id);
        setSubscriptions(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load subscriptions';
        setError(errorMessage);
        console.error('Error loading subscriptions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, [user]);

  // update the billing date in the form values when the calendar date is selected
  useEffect(() => {
    if (!date) {
      return;
    }
    
    setFormValues((prev) => ({
      ...prev,
      nextBillingDate: format(date, 'yyyy-MM-dd'),
    }));
  }, [date]);

  useEffect(() => {
    if (isPanelOpen) {
      window.requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    }
  }, [isPanelOpen]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = formValues.name.trim();

    if (!trimmedName) {
      setFormValues((prev) => ({
        ...prev,
        name: '',
      }));
      (nameInputRef.current as HTMLInputElement | null)?.focus();
      return;
    }

    if (!user) {
      // Demo mode - just update local state
      const subscription = {
        id: makeId(),
        name: trimmedName,
        cost: Number(formValues.cost),
        currency: formValues.currency,
        billingCycle: formValues.billingCycle,
        nextBillingDate: formValues.nextBillingDate,
      };

      if (editingSubscriptionId) {
        setSubscriptions((prev) =>
          prev.map((item) =>
            item.id === editingSubscriptionId ? { ...item, ...subscription } : item,
          ),
        );
      } else {
        setSubscriptions((prev) => [...prev, subscription]);
      }
      setFormValues(defaultFormValues);
      setDate(undefined);
      setEditingSubscriptionId(null);
      setIsPanelOpen(false);
      return;
    }

    // User is logged in - persist to database
    setError(null);
    try {
      const subscriptionData = {
        name: trimmedName,
        cost: Number(formValues.cost),
        currency: formValues.currency,
        billingCycle: formValues.billingCycle,
        nextBillingDate: formValues.nextBillingDate,
      };

      if (editingSubscriptionId) {
        const updated = await updateSubscription(user.id, {
          id: editingSubscriptionId,
          ...subscriptionData,
        });
        setSubscriptions((prev) =>
          prev.map((item) => (item.id === editingSubscriptionId ? updated : item)),
        );
      } else {
        const created = await createSubscription(user.id, subscriptionData);
        setSubscriptions((prev) => [...prev, created]);
      }

      setFormValues(defaultFormValues);
      setDate(undefined);
      setEditingSubscriptionId(null);
      setIsPanelOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save subscription';
      setError(errorMessage);
      console.error('Error saving subscription:', err);
    }
  };

  const handleEditSubscription = (subscription: Subscription) => {
    const parsedDate = parseDateInput(subscription.nextBillingDate);
    setFormValues({
      name: subscription.name,
      cost: String(subscription.cost ?? ''),
      currency: subscription.currency || 'USD',
      billingCycle: subscription.billingCycle,
      nextBillingDate: subscription.nextBillingDate ?? '',
    });
    setDate(parsedDate ?? undefined);
    setEditingSubscriptionId(subscription.id);
    setIsPanelOpen(true);
  };

  const handleDeleteRequest = (subscriptionId: string) => {
    setPendingDeleteId(subscriptionId);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) {
      return;
    }

    if (!user) {
      // Demo mode - just update local state
      setSubscriptions((prev) =>
        prev.filter((subscription) => subscription.id !== pendingDeleteId),
      );
      setPendingDeleteId(null);
      return;
    }

    // User is logged in - delete from database
    setError(null);
    try {
      await deleteSubscription(user.id, pendingDeleteId);
      setSubscriptions((prev) =>
        prev.filter((subscription) => subscription.id !== pendingDeleteId),
      );
      setPendingDeleteId(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete subscription';
      setError(errorMessage);
      console.error('Error deleting subscription:', err);
      // Still remove from UI on error? Or keep it? Let's keep it for now
    }
  };

  const handlePanelOpenChange = (open: boolean) => {
    setIsPanelOpen(open);
    if (!open) {
      setFormValues(defaultFormValues);
      setDate(undefined);
      setEditingSubscriptionId(null);
    }
  };

  const pendingDeleteSubscription = pendingDeleteId
    ? subscriptions.find((subscription) => subscription.id === pendingDeleteId)
    : null;

  const subtotal = subscriptions.reduce(
    (total, subscription) => total + Number(subscription.cost ?? 0),
    0,
  );

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  return (
    <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-4 pb-0 pt-4">
      {user && (
        <div className="flex items-center justify-end gap-3 mb-4">
          <span className="text-sm text-muted-foreground">
            Welcome, {user.name}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      )}
      
      {!user && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-amber-700 p-4">
          <p className="text-sm text-amber-800 font-bold">
            This page shows demo data. Please sign in to save and manage your own subscriptions.
          </p>
          <Link to="/signin" className="self-start sm:self-center">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800 font-medium">
            {error}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="text-red-800 hover:text-red-900"
          >
            Dismiss
          </Button>
        </div>
      )}

      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight mb-0">
            Subscription Tracker
          </h1>
          <p className="text-sm text-muted-foreground">
            A quick snapshot of your recurring web services.
          </p>
        </div>
        <Sheet open={isPanelOpen} onOpenChange={handlePanelOpenChange}>
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

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sub-currency">Currency</Label>
                  <Select
                    value={formValues.currency}
                    onValueChange={(value: string) =>
                      setFormValues((prev) => ({ ...prev, currency: value }))
                    }
                  >
                    <SelectTrigger id="sub-currency" className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CNY">CNY</SelectItem>
                      <SelectItem value="JPY">JPY</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                      <SelectItem value="AUD">AUD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sub-cost">Cost</Label>
                  <Input
                    id="sub-cost"
                    name="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formValues.cost}
                    onChange={handleChange}
                    placeholder="e.g. 12.99"
                  />
                </div>
              </div>
              
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sub-billing-cycle">Billing Cycle</Label>
                  <Select
                    name="sub-billing-cycle"
                    value={formValues.billingCycle}
                    onValueChange={(value: BillingCadence) =>
                      setFormValues((prev) => ({ ...prev, billingCycle: value }))
                    }
                  >
                    <SelectTrigger id="sub-billing-cycle" className="w-full">
                      <SelectValue placeholder="Select billing cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sub-billing-date">Next billing date</Label>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        id="date"
                        className="w-full justify-between font-normal"
                      >
                        {date ? date.toLocaleDateString() : "Select date"}
                        <ChevronDownIcon className="text-muted-foreground"/>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        captionLayout="dropdown"
                        onSelect={(date) => {
                          setDate(date)
                          setOpen(false)
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              
              <Button type="submit" className="w-full mt-4">Save</Button>
            </form>
          </SheetContent>
        </Sheet>
      </header>

      <section className="space-y-4 mb-24">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-sm text-muted-foreground">Loading subscriptions...</p>
            </div>
          </div>
        ) : (
          <div className="divide-y rounded-xl border border-border bg-card/80 shadow-sm backdrop-blur">
            {subscriptions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {user ? 'No subscriptions yet. Add your first subscription!' : 'No subscriptions to display.'}
                </p>
              </div>
            ) : (
              subscriptions.map((subscription) => (
                <div
                  className="flex flex-row gap-2 p-4 items-center justify-between"
                  key={subscription.id}
                >
                  <div>
                    <h3 className="text-lg font-medium">{subscription.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Next billing: {formatDate(subscription.nextBillingDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-lg font-semibold">
                        {formatCurrency(subscription.cost)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {subscription.billingCycle}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className="ml-3"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${subscription.name}`}
                        >
                          <MoreHorizontalIcon className="size-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => handleEditSubscription(subscription)}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => handleDeleteRequest(subscription.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <footer className="fixed left-0 bottom-0 w-full border-t-2 bg-background">
        <div className="flex items-center justify-between mx-auto max-w-3xl py-4 px-4">
          <span className="text-sm font-medium text-muted-foreground">
            Monthly subtotal
          </span>
          <span className="text-xl font-semibold">
            {formatCurrency(subtotal)}
          </span>
        </div>
      </footer>

      <AlertDialog
        open={Boolean(pendingDeleteSubscription)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subscription</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteSubscription
                ? `Are you sure you want to remove ${pendingDeleteSubscription.name}? This action cannot be undone.`
                : 'Are you sure you want to remove this subscription?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

export default SubscriptionTracker;
