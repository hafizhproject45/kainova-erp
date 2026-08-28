<script lang="ts">
  import { Select, Label, Helper, Input } from 'flowbite-svelte';

  type OptionItem = { value: string | number; name: string };

  let {
    label = '',
    name = '',
    items = [],
    value = $bindable(''),
    required = false,
    disabled = false,
    placeholder = 'Pilih...',
    error = '',
    searchable = false,
    class: className = '',
  }: {
    label?: string;
    name?: string;
    items?: OptionItem[];
    value?: string | number;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    error?: string;
    /** Saat true, menampilkan kotak filter teks di atas daftar opsi. */
    searchable?: boolean;
    class?: string;
  } = $props();

  let query = $state('');

  const filteredItems = $derived(
    searchable && query.trim()
      ? items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
      : items,
  );
</script>

<div class="flex flex-col gap-1">
  {#if label}
    <Label for={name} class="text-sm font-medium text-slate-700">
      {label}
      {#if required}<span class="text-red-600">*</span>{/if}
    </Label>
  {/if}

  {#if searchable}
    <Input
      type="search"
      placeholder="Cari {label || 'opsi'}..."
      bind:value={query}
      class="mb-1"
    />
  {/if}

  <Select
    id={name}
    {name}
    {disabled}
    {placeholder}
    items={filteredItems}
    color={error ? 'red' : 'default'}
    class={className}
    bind:value
  />

  {#if error}
    <Helper class="text-sm text-red-600">{error}</Helper>
  {/if}
</div>
