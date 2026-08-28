<script lang="ts">
  import { Input, Label, Helper } from 'flowbite-svelte';
  import { formatNumber, parseNumber } from '../utils/formatters';

  let {
    label = '',
    name = '',
    type = 'text',
    value = $bindable(''),
    required = false,
    disabled = false,
    placeholder = '',
    error = '',
    numeric = false,
    class: className = '',
  }: {
    label?: string;
    name?: string;
    type?: 'text' | 'number' | 'email' | 'password' | 'tel' | 'date';
    value?: string | number;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    error?: string;
    /** Saat true, input menampilkan delimiter ribuan on-the-fly (untuk nominal harga/qty). */
    numeric?: boolean;
    class?: string;
  } = $props();

  // Buffer teks yang ditampilkan ke user (sudah ber-delimiter) saat mode numeric.
  let displayValue = $state('');

  $effect(() => {
    displayValue = numeric ? formatNumber(value) : String(value ?? '');
  });

  function onNumericInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    const parsed = parseNumber(raw);
    value = parsed;
    displayValue = formatNumber(parsed);
  }
</script>

<div class="flex flex-col gap-1">
  {#if label}
    <Label for={name} class="text-sm font-medium text-slate-700">
      {label}
      {#if required}<span class="text-red-600">*</span>{/if}
    </Label>
  {/if}

  {#if numeric}
    <Input
      id={name}
      {name}
      {disabled}
      {placeholder}
      inputmode="numeric"
      color={error ? 'red' : 'default'}
      class={className}
      value={displayValue}
      oninput={onNumericInput}
    />
  {:else}
    <Input
      id={name}
      {name}
      {type}
      {disabled}
      {placeholder}
      color={error ? 'red' : 'default'}
      class={className}
      bind:value
    />
  {/if}

  {#if error}
    <Helper class="text-sm text-red-600">{error}</Helper>
  {/if}
</div>
