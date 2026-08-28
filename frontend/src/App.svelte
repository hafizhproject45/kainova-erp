<script lang="ts">
  import Router from 'svelte-spa-router';
  import { authState } from './lib/stores/auth';
  import Layout from './lib/Layout.svelte';
  import Login from './routes/Login.svelte';
  import Dashboard from './routes/Dashboard.svelte';
  import MasterDataList from './routes/master-data/MasterDataList.svelte';
  import MasterDataForm from './routes/master-data/MasterDataForm.svelte';
  import VariantMatrixForm from './routes/master-data/VariantMatrixForm.svelte';
  import Pos from './routes/Pos.svelte';
  import SalesHistory from './routes/SalesHistory.svelte';
  import PurchasingList from './routes/purchasing/PurchasingList.svelte';
  import PurchasingCreate from './routes/purchasing/PurchasingCreate.svelte';
  import PurchasingDetail from './routes/purchasing/PurchasingDetail.svelte';
  import PurchasingDocument from './routes/purchasing/PurchasingDocument.svelte';
  import StockProducts from './routes/inventory/StockProducts.svelte';
  import AdjustmentList from './routes/inventory/AdjustmentList.svelte';
  import AdjustmentCreate from './routes/inventory/AdjustmentCreate.svelte';
  import Reports from './routes/Reports.svelte';
  import Settings from './routes/Settings.svelte';
  import ReceiptPrint from './routes/ReceiptPrint.svelte';
  import NotFound from './routes/NotFound.svelte';

  const routes = {
    '/': Dashboard,
    '/master-data': MasterDataList,
    '/master-data/variants/matrix': VariantMatrixForm,
    '/master-data/:tab': MasterDataList,
    '/master-data/:tab/create': MasterDataForm,
    '/master-data/:tab/:id/edit': MasterDataForm,
    '/pos': Pos,
    '/pos/history': SalesHistory,
    '/purchasing': PurchasingList,
    '/purchasing/create': PurchasingCreate,
    '/purchasing/:id/edit': PurchasingCreate,
    '/purchasing/:id/document': PurchasingDocument,
    '/purchasing/:id': PurchasingDetail,
    '/inventory/stock-products': StockProducts,
    '/inventory/stock-adjustments': AdjustmentList,
    '/inventory/stock-adjustments/create': AdjustmentCreate,
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
