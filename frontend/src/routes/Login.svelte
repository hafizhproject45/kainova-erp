<script lang="ts">
  import { api, ApiClientError } from '../lib/api';
  import { setSession } from '../lib/stores/auth';

  let username = $state('');
  let password = $state('');
  let loading = $state(false);
  let errorMessage = $state('');

  interface LoginResponse {
    token: string;
    user: { id: string; name: string; role: 'OWNER' | 'GUDANG' | 'KASIR' };
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = '';
    loading = true;
    try {
      const result = await api.post<LoginResponse>('/auth/login', { username, password });
      setSession(result.token, result.user);
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal terhubung ke server';
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-100 px-4">
  <div class="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
    <h1 class="mb-1 text-xl font-semibold text-slate-900">KaiNova ERP</h1>
    <p class="mb-6 text-sm text-slate-500">Popyshop — masuk untuk melanjutkan</p>

    <form class="space-y-4" onsubmit={handleSubmit}>
      <div>
        <label for="username" class="mb-1 block text-sm font-medium text-slate-700">Username</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          required
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label for="password" class="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {#if errorMessage}
        <p class="text-sm text-red-600">{errorMessage}</p>
      {/if}

      <button
        type="submit"
        disabled={loading}
        class="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Memproses...' : 'Masuk'}
      </button>
    </form>
  </div>
</div>
