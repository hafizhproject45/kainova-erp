<script lang="ts">
  import { Button, Spinner } from 'flowbite-svelte';
  import type { Snippet } from 'svelte';

  type Variant = 'primary' | 'secondary' | 'outline' | 'danger';

  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    loading = false,
    class: className = '',
    onclick,
    children,
  }: {
    variant?: Variant;
    size?: 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    class?: string;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  } = $props();

  // Peta varian internal -> color & outline flowbite. `secondary` & `danger`
  // dipetakan ke token warna KaiNova (secondary = Rose, danger = red bawaan flowbite).
  const colorByVariant: Record<Variant, 'primary' | 'secondary' | 'red' | undefined> = {
    primary: 'primary',
    secondary: 'secondary',
    outline: undefined,
    danger: 'red',
  };
</script>

<Button
  {type}
  {size}
  disabled={disabled || loading}
  color={colorByVariant[variant]}
  outline={variant === 'outline'}
  class={className}
  {onclick}
>
  {#if loading}
    <Spinner size="4" class="me-2" />
  {/if}
  {@render children?.()}
</Button>
