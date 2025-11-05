import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import { useAuth } from '@/contexts/AuthContext';
import {
  assignProviderToSubscription,
  deleteProvider,
  loadProviders,
  loadUnmatchedSubscriptions,
  type ProviderInput,
  upsertProvider,
  type UnmatchedSubscription,
} from '@/lib/provider-service';
import { getFallbackIconKeys } from '@/lib/provider-utils';
import type { SubscriptionProvider, FallbackIconKey } from '@/types/subscription';

const NEW_PROVIDER: ProviderInput = {
  slug: '',
  displayName: '',
  logoPath: '',
  notes: '',
  lastVerifiedAt: null,
};

const formatVerifiedDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const AdminProvidersPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [providers, setProviders] = useState<SubscriptionProvider[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedSubscription[]>([]);
  const [form, setForm] = useState<ProviderInput>(NEW_PROVIDER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<
    Record<string, { providerId: string | null; fallbackIconKey: FallbackIconKey | null }>
  >({});

  const fallbackKeys = useMemo(() => getFallbackIconKeys(), []);

  const refreshData = async () => {
    try {
      const [providerRows, unmatchedRows] = await Promise.all([
        loadProviders(),
        loadUnmatchedSubscriptions(),
      ]);
      setProviders(providerRows);
      setUnmatched(unmatchedRows);
      setAssignments((current) => {
        const next: Record<
          string,
          { providerId: string | null; fallbackIconKey: FallbackIconKey | null }
        > = { ...current };
        unmatchedRows.forEach((row) => {
          if (!next[row.id]) {
            next[row.id] = {
              providerId: null,
              fallbackIconKey: row.fallbackIconKey ?? null,
            };
          }
        });
        return next;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load provider data';
      setError(message);
    }
  };

  useEffect(() => {
    if (!loading && user?.isAdmin) {
      refreshData();
    }
  }, [loading, user]);

  useEffect(() => {
    if (!form.id && !form.slug) {
      setSuccess(null);
    }
  }, [form.id, form.slug]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center">
        <p className="text-muted-foreground">Checking access…</p>
      </main>
    );
  }

  if (!user?.isAdmin) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-2xl font-semibold">Restricted</h1>
        <p className="text-sm text-muted-foreground">
          You need admin access to manage provider data.
        </p>
        <Button variant="outline" onClick={() => navigate('/')}>
          Go back
        </Button>
      </main>
    );
  }

  const handleSelectProvider = (provider: SubscriptionProvider) => {
    setForm({
      id: provider.id,
      slug: provider.slug,
      displayName: provider.displayName,
      logoPath: provider.logoPath,
      notes: provider.notes ?? '',
      lastVerifiedAt: provider.lastVerifiedAt,
    });
    setSuccess(null);
    setError(null);
  };

  const handleCreateNewProvider = () => {
    setForm(NEW_PROVIDER);
    setSuccess(null);
    setError(null);
  };

  const handleChange = (field: keyof ProviderInput, value: string | null) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!form.slug.trim() || !form.displayName.trim() || !form.logoPath.trim()) {
      setError('Slug, display name, and logo path are required.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await upsertProvider({
        ...form,
        slug: form.slug.trim(),
        displayName: form.displayName.trim(),
        logoPath: form.logoPath.trim(),
        notes: form.notes?.trim() || null,
      });
      setSuccess('Provider saved.');
      await refreshData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save provider';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteProvider(form.id);
      setForm(NEW_PROVIDER);
      setSuccess('Provider deleted.');
      await refreshData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete provider';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkVerified = () => {
    setForm((prev) => ({
      ...prev,
      lastVerifiedAt: new Date().toISOString(),
    }));
  };

  const handleAssignmentChange = (
    subscriptionId: string,
    field: 'providerId' | 'fallbackIconKey',
    value: string
  ) => {
    setAssignments((prev) => ({
      ...prev,
      [subscriptionId]: {
        providerId:
          field === 'providerId'
            ? value === 'none'
              ? null
              : value
            : prev[subscriptionId]?.providerId ?? null,
        fallbackIconKey:
          field === 'fallbackIconKey'
            ? (value === 'none' ? null : (value as FallbackIconKey))
            : prev[subscriptionId]?.fallbackIconKey ?? null,
      },
    }));
  };

  const handleApplyAssignment = async (subscriptionId: string) => {
    const selection = assignments[subscriptionId] ?? {
      providerId: null,
      fallbackIconKey: null,
    };
    setError(null);
    setSuccess(null);
    try {
      await assignProviderToSubscription(subscriptionId, selection.providerId, {
        fallbackIconKey: selection.fallbackIconKey ?? null,
      });
      setSuccess('Assignment updated.');
      await refreshData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update assignment';
      setError(message);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Provider Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            Maintain subscription providers, logos, and overrides.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/')}>
          Back to app
        </Button>
      </div>

      {(error || success) && (
        <div
          className={`rounded-lg border p-4 ${
            error
              ? 'border-red-300 bg-red-50 text-red-800'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error ?? success}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.3fr,1fr]">
        <div className="rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Providers</h2>
            <Button variant="secondary" size="sm" onClick={handleCreateNewProvider}>
              New provider
            </Button>
          </div>
          <div className="mt-4 divide-y border-y border-border">
            {providers.map((provider) => {
              const verifiedDate = formatVerifiedDate(provider.lastVerifiedAt);
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleSelectProvider(provider)}
                  className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <SubscriptionLogo
                      providerName={provider.displayName}
                      logoPath={provider.logoPath}
                      fallbackIconKey={null}
                      subscriptionName={provider.displayName}
                      sizeClassName="h-10 w-10"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{provider.displayName}</p>
                        {verifiedDate && (
                          <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {provider.slug}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {verifiedDate ? `${verifiedDate}` : 'Not verified'}
                  </span>
                </button>
              );
            })}
            {providers.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                No providers found. Add one to get started.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
          <h2 className="text-xl font-semibold">
            {form.id ? 'Edit provider' : 'New provider'}
          </h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider-slug">Slug</Label>
              <Input
                id="provider-slug"
                value={form.slug}
                onChange={(event) =>
                  handleChange('slug', event.target.value.replace(/\s+/g, '-').toLowerCase())
                }
                placeholder="e.g. netflix"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-name">Display name</Label>
              <Input
                id="provider-name"
                value={form.displayName}
                onChange={(event) => handleChange('displayName', event.target.value)}
                placeholder="Netflix"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-logo">Logo path</Label>
              <Input
                id="provider-logo"
                value={form.logoPath}
                onChange={(event) => handleChange('logoPath', event.target.value)}
                placeholder="/logos/netflix.svg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-notes">Notes</Label>
              <Textarea
                id="provider-notes"
                value={form.notes ?? ''}
                onChange={(event) => handleChange('notes', event.target.value)}
                rows={3}
                placeholder="Optional maintenance notes"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Last verified:{' '}
                <span className="font-medium text-foreground">
                  {formatVerifiedDate(form.lastVerifiedAt) ?? 'Not verified'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleMarkVerified}>
                Mark verified now
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {form.id && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Unmatched subscriptions</h2>
            <p className="text-sm text-muted-foreground">
              Assign providers or choose a fallback icon for unmatched entries.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={refreshData}>
            Refresh
          </Button>
        </div>
        <div className="mt-4 divide-y border-y border-border">
          {unmatched.map((item) => {
            const selection = assignments[item.id] ?? {
              providerId: null,
              fallbackIconKey: item.fallbackIconKey ?? null,
            };
            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.normalizedName || '—'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <Select
                    value={selection.providerId ?? 'none'}
                    onValueChange={(value) =>
                      handleAssignmentChange(item.id, 'providerId', value)
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No provider</SelectItem>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={selection.fallbackIconKey ?? 'none'}
                    onValueChange={(value) =>
                      handleAssignmentChange(item.id, 'fallbackIconKey', value)
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Fallback icon" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Random</SelectItem>
                      {fallbackKeys.map((key) => (
                        <SelectItem key={key} value={key}>
                          {key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyAssignment(item.id)}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            );
          })}
          {unmatched.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Everything is matched! 🎉
            </p>
          )}
        </div>
      </section>
    </main>
  );
};

export default AdminProvidersPage;
