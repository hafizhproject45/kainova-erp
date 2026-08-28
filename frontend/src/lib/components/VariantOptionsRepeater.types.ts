// Tipe baris repeater dipisah dari VariantOptionsRepeater.svelte supaya bisa di-import
// sebagai plain TS type oleh consumer (MasterDataForm.svelte, VariantMatrixForm.svelte)
// tanpa perlu `<script module>` export dari file .svelte.
export interface VariantOptionRow {
  attribute: 'WARNA' | 'UKURAN' | '';
  values: string;
}
