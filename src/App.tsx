import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/ui/dialog.jsx';
import { cn } from './lib/utils.js';
import { ChevronDownIcon, MoreHorizontalIcon, SettingsIcon, LogOut } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format, isBefore, startOfDay } from 'date-fns';
import { seedSubscriptions } from '@/lib/subscription-data';
import { autoAdvanceSubscriptions, rollForwardNextBillingDate } from '@/lib/billing-utils';
import {
  loadSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from '@/lib/subscription-service';
import {
  loadUserSettings,
  saveUserSettings,
} from '@/lib/user-settings-service';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import { ProviderSuggestionList } from '@/components/ProviderSuggestionList';
import { getProviderBySlug } from '@/data/provider-catalog';
import { normalizeSubscriptionName, pickFallbackIconKey } from '@/lib/provider-utils';
import { useProviderCatalog, type ProviderSearchResult } from '@/hooks/useProviderCatalog';
import type {
  BillingCadence,
  Subscription,
  SubscriptionFormValues,
  SubscriptionProvider,
} from '@/types/subscription';

const formatCurrency = (value: string | number, currency?: string) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return '$0.00';
  }

  const currencyCode = currency || 'USD';
  
  // For JPY and CNY, typically don't show decimal places
  const useDecimals = !['JPY', 'CNY'].includes(currencyCode);
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: useDecimals ? (numeric % 1 === 0 ? 0 : 2) : 0,
    maximumFractionDigits: useDecimals ? 2 : 0,
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

const getDefaultFormValues = (primaryCurrency: string = 'USD'): SubscriptionFormValues => ({
  name: '',
  cost: '',
  currency: primaryCurrency,
  billingCycle: 'Monthly',
  nextBillingDate: '',
});

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
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() =>
    autoAdvanceSubscriptions(seedSubscriptions).subscriptions,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [primaryCurrency, setPrimaryCurrency] = useState<string>('USD');
  const [settingsCurrency, setSettingsCurrency] = useState<string>('USD');
  const [displayName, setDisplayName] = useState<string>('');
  const [settingsDisplayName, setSettingsDisplayName] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [formValues, setFormValues] = useState<SubscriptionFormValues>(getDefaultFormValues('USD'));
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const isDesktop = useMediaQuery('(min-width: 640px)');
  const { search, findBySlug, findByDisplayName } = useProviderCatalog(Boolean(user));
  const [selectedProvider, setSelectedProvider] = useState<SubscriptionProvider | null>(null);
  const [providerSuggestions, setProviderSuggestions] = useState<ProviderSearchResult[]>([]);
  const [showProviderSuggestions, setShowProviderSuggestions] = useState(false);
  const [isAddingSubscription, setIsAddingSubscription] = useState(true);

  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [today, setToday] = useState<Date>(() => startOfDay(new Date()));
  const persistAutoAdvancedDates = useCallback((subs: Subscription[]) => {
    if (!user || subs.length === 0) {
      return;
    }

    void Promise.all(
      subs.map((subscription) =>
        updateSubscription(user.id, subscription).catch((err) => {
          console.error('Error updating billing date', err);
        }),
      ),
    );
  }, [user]);

  // Load user settings and subscriptions from database when user logs in
  useEffect(() => {
    if (!user) {
      // Reset to seed data when logged out
      setSubscriptions(autoAdvanceSubscriptions(seedSubscriptions).subscriptions);
      setError(null);
      setPrimaryCurrency('USD');
      setSettingsCurrency('USD');
      setDisplayName('');
      setSettingsDisplayName('');
      setFormValues(getDefaultFormValues('USD'));
      setSelectedProvider(null);
      setProviderSuggestions([]);
      setShowProviderSuggestions(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load user settings first
        const settings = await loadUserSettings(user.id, user.email);
        setPrimaryCurrency(settings.primaryCurrency);
        setSettingsCurrency(settings.primaryCurrency);
        setDisplayName(settings.displayName);
        setSettingsDisplayName(settings.displayName);
        setFormValues(getDefaultFormValues(settings.primaryCurrency));
        setSelectedProvider(null);
        setProviderSuggestions([]);
        setShowProviderSuggestions(false);

        // Then load subscriptions
        const data = await loadSubscriptions(user.id);
        const { subscriptions: hydrated, changedSubscriptions } = autoAdvanceSubscriptions(data);
        setSubscriptions(hydrated);
        persistAutoAdvancedDates(changedSubscriptions);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
        setError(errorMessage);
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
    if (typeof window === 'undefined') {
      return undefined;
    }

    const advanceDatesIfNeeded = () => {
      setToday((prev) => {
        const next = startOfDay(new Date());
        return prev.getTime() === next.getTime() ? prev : next;
      });
      setSubscriptions((prev) => {
        const { subscriptions: advanced, changedSubscriptions } = autoAdvanceSubscriptions(prev);
        if (changedSubscriptions.length === 0) {
          return prev;
        }
        persistAutoAdvancedDates(changedSubscriptions);
        return advanced;
      });
    };

    advanceDatesIfNeeded();

    const intervalId = window.setInterval(advanceDatesIfNeeded, 1000 * 60 * 60);
    return () => window.clearInterval(intervalId);
  }, [persistAutoAdvancedDates]);

  useEffect(() => {
    if (!isPanelOpen || !isAddingSubscription) {
      return undefined;
    }

    const rafId = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [isPanelOpen, isAddingSubscription]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === 'name') {
      const normalized = normalizeSubscriptionName(value);
      const lowerValue = value.trim().toLowerCase();

      if (
        selectedProvider &&
        selectedProvider.slug !== normalized &&
        selectedProvider.displayName.trim().toLowerCase() !== lowerValue
      ) {
        setSelectedProvider(null);
      }

      const matches = search(value);
      setProviderSuggestions(matches);
      setShowProviderSuggestions(matches.length > 0);
    }
  };

  const handleNameBlur = () => {
    const currentValue = formValues.name.trim();
    if (!currentValue) {
      setProviderSuggestions([]);
      setShowProviderSuggestions(false);
      return;
    }

    const normalized = normalizeSubscriptionName(currentValue);
    let provider = findBySlug(normalized);
    if (!provider) {
      provider = findByDisplayName(currentValue);
    }
    if (provider) {
      setSelectedProvider(provider);
      setFormValues((prev) => ({
        ...prev,
        name: provider.displayName,
      }));
    }

    setProviderSuggestions([]);
    setShowProviderSuggestions(false);
  };

  const handleProviderSelect = (provider: ProviderSearchResult) => {
    setSelectedProvider(provider);
    setFormValues((prev) => ({
      ...prev,
      name: provider.displayName,
    }));
    setProviderSuggestions([]);
    setShowProviderSuggestions(false);
  };

  const handleClearSelectedProvider = () => {
    setSelectedProvider(null);
    setFormValues((prev) => ({
      ...prev,
      name: '',
    }));
    setProviderSuggestions([]);
    setShowProviderSuggestions(false);
    window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const trimmedName = formValues.name.trim();

    if (!trimmedName) {
      setFormValues((prev) => ({
        ...prev,
        name: '',
      }));
      (nameInputRef.current as HTMLInputElement | null)?.focus();
      return;
    }

    const parsedNextBillingDate = parseDateInput(formValues.nextBillingDate);
    if (!parsedNextBillingDate) {
      setError('Please select a valid next billing date.');
      return;
    }

    const normalizedNextBillingDate = startOfDay(parsedNextBillingDate);
    const todayStart = startOfDay(new Date());
    if (isBefore(normalizedNextBillingDate, todayStart)) {
      setError('Next billing date cannot be in the past.');
      return;
    }

    const normalizedNextBillingDateString = format(normalizedNextBillingDate, 'yyyy-MM-dd');

    const normalizedName = normalizeSubscriptionName(trimmedName);
    let providerSelection = selectedProvider;
    if (!providerSelection) {
      providerSelection = user ? findBySlug(normalizedName) : getProviderBySlug(normalizedName);
    }
    if (!providerSelection) {
      providerSelection = findByDisplayName(trimmedName) ?? null;
    }
    const fallbackIconKey = providerSelection ? null : pickFallbackIconKey(normalizedName);

    if (!user) {
      // Demo mode - just update local state
      const subscription = {
        id: makeId(),
        name: trimmedName,
        cost: Number(formValues.cost),
        currency: formValues.currency,
        billingCycle: formValues.billingCycle,
        nextBillingDate: normalizedNextBillingDateString,
        providerId: providerSelection?.id ?? null,
        providerSlug: providerSelection?.slug ?? null,
        providerName: providerSelection?.displayName ?? null,
        logoPath: providerSelection?.logoPath ?? null,
        fallbackIconKey,
        normalizedName,
      };
      const rolledDate = rollForwardNextBillingDate(subscription.nextBillingDate, subscription.billingCycle);
      const subscriptionForState = rolledDate
        ? { ...subscription, nextBillingDate: rolledDate }
        : subscription;

      if (editingSubscriptionId) {
        setSubscriptions((prev) => {
          const updated = prev.map((item) =>
            item.id === editingSubscriptionId ? { ...item, ...subscriptionForState } : item,
          );
          return autoAdvanceSubscriptions(updated).subscriptions;
        });
      } else {
        setSubscriptions((prev) =>
          autoAdvanceSubscriptions([subscriptionForState, ...prev]).subscriptions,
        );
      }
      setFormValues(getDefaultFormValues(primaryCurrency));
      setDate(undefined);
      setEditingSubscriptionId(null);
      setIsPanelOpen(false);
      setSelectedProvider(null);
      setProviderSuggestions([]);
      setShowProviderSuggestions(false);
      return;
    }

    // User is logged in - persist to database
    setError(null);
    try {
      let subscriptionData: Omit<Subscription, 'id'> = {
        name: trimmedName,
        cost: Number(formValues.cost),
        currency: formValues.currency,
        billingCycle: formValues.billingCycle,
        nextBillingDate: normalizedNextBillingDateString,
        providerId: providerSelection?.id ?? null,
        providerSlug: providerSelection?.slug ?? null,
        providerName: providerSelection?.displayName ?? null,
        logoPath: providerSelection?.logoPath ?? null,
        fallbackIconKey,
        normalizedName,
      };
      const rolledDateForUser = rollForwardNextBillingDate(
        subscriptionData.nextBillingDate,
        subscriptionData.billingCycle,
      );
      if (rolledDateForUser) {
        subscriptionData = { ...subscriptionData, nextBillingDate: rolledDateForUser };
      }

      if (editingSubscriptionId) {
        const updated = await updateSubscription(user.id, {
          id: editingSubscriptionId,
          ...subscriptionData,
        });
        setSubscriptions((prev) => {
          const next = prev.map((item) => (item.id === editingSubscriptionId ? updated : item));
          return autoAdvanceSubscriptions(next).subscriptions;
        });
      } else {
        const created = await createSubscription(user.id, subscriptionData);
        setSubscriptions((prev) =>
          autoAdvanceSubscriptions([created, ...prev]).subscriptions,
        );
      }

      setFormValues(getDefaultFormValues(primaryCurrency));
      setDate(undefined);
      setEditingSubscriptionId(null);
      setIsPanelOpen(false);
      setSelectedProvider(null);
      setProviderSuggestions([]);
      setShowProviderSuggestions(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save subscription';
      setError(errorMessage);
      console.error('Error saving subscription:', err);
    }
  };

  const handleEditSubscription = (subscription: Subscription) => {
    setIsAddingSubscription(false);
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
    const normalized = subscription.providerSlug ?? normalizeSubscriptionName(subscription.name);
    if (subscription.providerId && subscription.providerName) {
      setSelectedProvider({
        id: subscription.providerId,
        slug: subscription.providerSlug ?? normalized,
        displayName: subscription.providerName,
        logoPath: subscription.logoPath ?? '',
        lastVerifiedAt: null,
        notes: null,
      });
    } else {
      setSelectedProvider(null);
    }
    setProviderSuggestions([]);
    setShowProviderSuggestions(false);
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
      setSubscriptions((prev) => {
        const next = prev.filter((subscription) => subscription.id !== pendingDeleteId);
        return autoAdvanceSubscriptions(next).subscriptions;
      });
      setPendingDeleteId(null);
      return;
    }

    // User is logged in - delete from database
    setError(null);
    try {
      await deleteSubscription(user.id, pendingDeleteId);
      setSubscriptions((prev) => {
        const next = prev.filter((subscription) => subscription.id !== pendingDeleteId);
        return autoAdvanceSubscriptions(next).subscriptions;
      });
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
      setFormValues(getDefaultFormValues(primaryCurrency));
      setDate(undefined);
      setEditingSubscriptionId(null);
      setSelectedProvider(null);
      setProviderSuggestions([]);
      setShowProviderSuggestions(false);
      setIsAddingSubscription(true);
    } else if (!editingSubscriptionId) {
      setSelectedProvider(null);
      setProviderSuggestions([]);
      setShowProviderSuggestions(false);
      setIsAddingSubscription(true);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;

    setSavingSettings(true);
    setError(null);
    try {
      const settings = await saveUserSettings(user.id, {
        primaryCurrency: settingsCurrency,
        displayName: settingsDisplayName.trim() || user.email,
      }, user.email);
      setPrimaryCurrency(settings.primaryCurrency);
      setDisplayName(settings.displayName);
      setFormValues((prev) => ({
        ...prev,
        currency: settings.primaryCurrency,
      }));
      setIsSettingsOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setError(errorMessage);
      console.error('Error saving settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSettingsOpenChange = (open: boolean) => {
    setIsSettingsOpen(open);
    // Reset settings to current values when opening
    if (open) {
      setSettingsCurrency(primaryCurrency);
      setSettingsDisplayName(displayName);
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
        <div className="flex items-center justify-between gap-3 mb-4">
          <span className="text-sm text-muted-foreground">
            Welcome, {displayName || user.email}
          </span>
          <div className="flex items-center gap-3">
            {user.isAdmin && (
              <Link to="/admin/providers">
                <Button variant="outline" size="sm">
                  Admin
                </Button>
              </Link>
            )}
            <Dialog open={isSettingsOpen} onOpenChange={handleSettingsOpenChange}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Settings">
                  <SettingsIcon className="size-4" />
                  <span>Settings</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Settings</DialogTitle>
                  <DialogDescription>
                    Manage your preferences
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="settings-display-name">Display Name</Label>
                    <Input
                      id="settings-display-name"
                      value={settingsDisplayName}
                      onChange={(e) => setSettingsDisplayName(e.target.value)}
                      placeholder={user.email}
                    />
                    <p className="text-xs text-muted-foreground">
                      This name will be displayed in the header. If left empty, your email will be used.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-primary-currency">Primary Currency</Label>
                    <Select
                      value={settingsCurrency}
                      onValueChange={(value: string) =>
                        setSettingsCurrency(value)
                      }
                    >
                      <SelectTrigger id="settings-primary-currency" className="w-full">
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
                    <p className="text-xs text-muted-foreground">
                      This will be used as the default currency for new subscriptions and for displaying the subtotal.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsSettingsOpen(false)}
                    disabled={savingSettings}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                  >
                    {savingSettings ? 'Saving...' : 'Save'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      )}
      
      {!user && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-muted py-2 px-4">
          <p className="text-sm">
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
            <Button
              className="self-start"
              onClick={() => {
                setIsAddingSubscription(true);
                setEditingSubscriptionId(null);
                setSelectedProvider(null);
              }}
            >
              Add subscription
            </Button>
          </SheetTrigger>
          <SheetContent
            side={isDesktop ? 'right' : 'bottom'}
            onOpenAutoFocus={(event) => {
              if (!isAddingSubscription) {
                event.preventDefault();
              }
            }}
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
                <div className="relative">
                  <Input
                    id="sub-name"
                    name="name"
                    required
                    value={formValues.name}
                    onChange={handleChange}
                    onBlur={handleNameBlur}
                    aria-autocomplete="list"
                    aria-expanded={showProviderSuggestions}
                    autoComplete="off"
                    ref={nameInputRef}
                    placeholder="Service name"
                  />
                  {showProviderSuggestions && providerSuggestions.length > 0 && (
                    <ProviderSuggestionList
                      anchorId="sub-name"
                      results={providerSuggestions}
                      onSelect={handleProviderSelect}
                      onClose={() => setShowProviderSuggestions(false)}
                    />
                  )}
                </div>
                {selectedProvider && (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                    <SubscriptionLogo
                      providerName={selectedProvider.displayName}
                      logoPath={selectedProvider.logoPath}
                      fallbackIconKey={null}
                      subscriptionName={selectedProvider.displayName}
                      sizeClassName="h-9 w-9"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{selectedProvider.displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {selectedProvider.slug}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearSelectedProvider}
                      className="ml-auto"
                    >
                      Clear
                    </Button>
                  </div>
                )}
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
                        disabled={{ before: today }}
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
          <div className="divide-y rounded-xl border border-border bg-card/80">
            {subscriptions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {user ? 'No subscriptions yet. Add your first subscription!' : 'No subscriptions to display.'}
                </p>
              </div>
            ) : (
              subscriptions.map((subscription) => (
                <div
                  className="flex flex-row items-center justify-between gap-4 p-4"
                  key={subscription.id}
                >
                  <div className="flex items-center gap-3">
                    <SubscriptionLogo
                      providerName={subscription.providerName}
                      logoPath={subscription.logoPath}
                      fallbackIconKey={subscription.fallbackIconKey}
                      subscriptionName={subscription.name}
                    />
                    <div>
                      <h3 className="text-lg font-medium">{subscription.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        Next billing: {formatDate(subscription.nextBillingDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-lg font-semibold">
                        {formatCurrency(subscription.cost, subscription.currency)}
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
            {formatCurrency(subtotal, primaryCurrency)}
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
