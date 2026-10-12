import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { RequireAuth, RequireAdmin } from "@/hooks/useAuthGuard";
import { useAuthStore } from "@/store/authStore";

import { Home } from "@/pages/Home";
import { Products } from "@/pages/Products";
import { ProductDetail } from "@/pages/ProductDetail";
import { CategoryPage } from "@/pages/CategoryPage";
import { Cart } from "@/pages/Cart";
import { Checkout } from "@/pages/Checkout";
import { OrderSuccess } from "@/pages/OrderSuccess";
import { OrderTracking } from "@/pages/OrderTracking";
import { Account } from "@/pages/Account";
import { Wishlist } from "@/pages/Wishlist";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { About } from "@/pages/About";
import { Contact } from "@/pages/Contact";
import { LegalPage } from "@/pages/LegalPage";
import { NotFound } from "@/pages/NotFound";

import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminProducts } from "@/pages/admin/AdminProducts";
import { AdminOrders } from "@/pages/admin/AdminOrders";
import { AdminAnalytics } from "@/pages/admin/AdminAnalytics";
import { AdminCategories } from "@/pages/admin/AdminCategories";
import { AdminCarousel } from "@/pages/admin/AdminCarousel";
import { AdminSettings } from "@/pages/admin/AdminSettings";

export default function App() {
  const seedDemoAccounts = useAuthStore((s) => s.seedDemoAccounts);

  useEffect(() => {
    void seedDemoAccounts();
  }, [seedDemoAccounts]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/categories/:slug" element={<CategoryPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-success/:orderNumber" element={<OrderSuccess />} />
          <Route path="/order-tracking" element={<OrderTracking />} />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <Account />
              </RequireAuth>
            }
          />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy-policy" element={<LegalPage slug="privacy-policy" />} />
          <Route path="/terms-of-service" element={<LegalPage slug="terms-of-service" />} />
          <Route path="/refund-policy" element={<LegalPage slug="refund-policy" />} />
          <Route path="/cookie-policy" element={<LegalPage slug="cookie-policy" />} />
          <Route path="/disclaimer" element={<LegalPage slug="disclaimer" />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="carousel" element={<AdminCarousel />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
