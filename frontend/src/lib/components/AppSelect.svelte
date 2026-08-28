<script lang="ts">
  import { Label, Helper } from 'flowbite-svelte';
  import { ChevronDownOutline, CloseOutline } from 'flowbite-svelte-icons';

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
    class?: string;
  } = $props();

  // Search & pilih jadi satu widget (combobox) — tidak ada lagi kotak "Cari..." terpisah
  // di atas dropdown. Ketik untuk memfilter, klik/Enter untuk memilih.
  let open = $state(false);
  let query = $state('');
  let highlighted = $state(-1);
  let containerEl: HTMLDivElement | undefined = $state();
  let inputEl: HTMLInputElement | undefined = $state();

  const selectedItem = $derived(items.find((item) => String(item.value) === String(value)));
  const filteredItems = $derived(
    query.trim() ? items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())) : items,
  );
  const displayText = $derived(open ? query : (selectedItem?.name ?? ''));

  function openList() {
    if (disabled) return;
    open = true;
    query = '';
    highlighted = -1;
  }

  function closeList() {
    open = false;
    query = '';
    highlighted = -1;
  }

  function selectItem(item: OptionItem) {
    value = item.value;
    closeList();
    inputEl?.blur();
  }

  function clearValue(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    value = '';
    closeList();
    inputEl?.focus();
  }

  function handleFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (!containerEl?.contains(next)) closeList();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      openList();
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      highlighted = Math.min(highlighted + 1, filteredItems.length - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      highlighted = Math.max(highlighted - 1, 0);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const item = filteredItems[highlighted] ?? filteredItems[0];
      if (item) selectItem(item);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      closeList();
      inputEl?.blur();
    }
  }
</script>

<div class="flex flex-col gap-1">
  {#if label}
    <Label for={name} class="text-sm font-medium text-slate-700">
      {label}
      {#if required}<span class="text-red-600">*</span>{/if}
    </Label>
  {/if}

  <div bind:this={containerEl} class="relative" onfocusout={handleFocusOut}>
    <div class="relative">
      <input
        bind:this={inputEl}
        id={name}
        {name}
        {disabled}
        {required}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="{name}-listbox"
        aria-autocomplete="list"
        autocomplete="off"
        placeholder={selectedItem ? undefined : placeholder}
        value={displayText}
        onfocus={openList}
        oninput={(e) => {
          query = (e.currentTarget as HTMLInputElement).value;
          open = true;
          highlighted = -1;
        }}
        onkeydown={handleKeydown}
        class="w-full rounded-lg border {error
          ? 'border-red-500'
          : 'border-slate-300'} bg-white px-3 py-2 {selectedItem && !disabled
          ? 'pr-16'
          : 'pr-9'} text-sm text-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-slate-100 {className}"
      />
      {#if selectedItem && !disabled}
        <button
          type="button"
          aria-label="Hapus pilihan"
          onmousedown={(e) => e.preventDefault()}
          onclick={clearValue}
          class="absolute right-8 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <CloseOutline class="h-3.5 w-3.5" />
        </button>
      {/if}
      <ChevronDownOutline class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>

    {#if open}
      <ul
        id="{name}-listbox"
        role="listbox"
        class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
      >
        {#if filteredItems.length === 0}
          <li class="px-3 py-2 text-slate-400">Tidak ada hasil</li>
        {:else}
          {#each filteredItems as item, i (item.value)}
            <li>
              <button
                type="button"
                onmousedown={(e) => e.preventDefault()}
                onclick={() => selectItem(item)}
                class="block w-full px-3 py-2 text-left {i === highlighted ? 'bg-primary-50' : 'hover:bg-slate-50'} {String(
                  item.value,
                ) === String(value)
                  ? 'font-medium text-primary-700'
                  : 'text-slate-700'}"
              >
                {item.name}
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    {/if}
  </div>

  {#if error}
    <Helper class="text-sm text-red-600">{error}</Helper>
  {/if}
</div>
