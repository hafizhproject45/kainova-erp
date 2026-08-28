<script lang="ts">
  import Router from 'svelte-spa-router';
  import { authState } from './lib/stores/auth';
  import Layout from './lib/Layout.svelte';
  import Login from './routes/Login.svelte';
  import Dashboard from './routes/Dashboard.svelte';
  import MasterDataList from './routes/master-data/MasterDataList.svelte';
  import MasterDataForm from './routes/master-data/MasterDataForm.svelte';
  import Pos from './routes/Pos.svelte';
  import Purchasing from './routes/Purchasing.svelte';
  import StockAdjustment from './routes/StockAdjustment.svelte';
  import Reports from './routes/Reports.svelte';
  import Settings from './routes/Settings.svelte';
  import ReceiptPrint from './routes/ReceiptPrint.svelte';
  import NotFound from './routes/NotFound.svelte';

  const routes = {
    '/': Dashboard,
    '/master-data': MasterDataList,
    '/master-data/:tab': MasterDataList,
    '/master-data/:tab/create': MasterDataForm,
    '/master-data/:tab/:id/edit': MasterDataForm,
    '/pos': Pos,
    '/purchasing': Purchasing,
    '/stock-adjustment': StockAdjustment,
    '/reports': Reports,
    '/settings': Settings,
    '/receipt/:id': ReceiptPrint,
    '*': NotFound,
  };
</script>

{#if !$authState.token}
  <Login />
{:else}
  <Layout>
    <Router {routes} />
  </Layout>
{/if}
