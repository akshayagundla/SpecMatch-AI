
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- products (public read)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  image_url TEXT,
  specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  profile_text TEXT NOT NULL,
  embedding JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read" ON public.products FOR SELECT TO anon, authenticated USING (true);

-- sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New analysis',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_owner_all" ON public.sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX sessions_user_idx ON public.sessions(user_id, last_message_at DESC);

-- messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  image_url TEXT,
  extracted_specs JSONB,
  recommendations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_owner_all" ON public.messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX messages_session_idx ON public.messages(session_id, created_at);

-- seed 10 products
INSERT INTO public.products (name, brand, category, price_cents, image_url, specs, profile_text) VALUES
('MacBook Pro 14" M3 Max', 'Apple', 'laptop', 319900, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800',
 '{"ram":"36GB","processor":"Apple M3 Max","os":"macOS 14","ports":["Thunderbolt 4 x3","HDMI 2.1","SDXC","MagSafe 3"],"ecosystem":"Apple","display":"14.2\" Liquid Retina XDR 120Hz","wireless":["Wi-Fi 6E","Bluetooth 5.3"]}',
 'Apple MacBook Pro 14 M3 Max laptop with 36GB RAM, Thunderbolt 4 ports, HDMI 2.1 supports external 4K 144Hz display, macOS, deep Apple ecosystem integration, iCloud, AirDrop, Continuity.'),
('Dell XPS 15 9530', 'Dell', 'laptop', 219900, 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800',
 '{"ram":"32GB","processor":"Intel Core i9-13900H","os":"Windows 11","ports":["Thunderbolt 4 x2","USB-C 3.2","SD card"],"ecosystem":"Windows","display":"15.6\" OLED 3.5K","wireless":["Wi-Fi 6E","Bluetooth 5.2"],"gpu":"NVIDIA RTX 4070"}',
 'Dell XPS 15 Windows laptop with RTX 4070 GPU, Thunderbolt 4 supports external 4K 144Hz monitors via DisplayPort 1.4, 32GB RAM, Windows 11, broad Windows ecosystem compatibility.'),
('Samsung Galaxy S26 Ultra', 'Samsung', 'smartphone', 129900, 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800',
 '{"ram":"12GB","processor":"Snapdragon 8 Gen 4","os":"Android 15","ports":["USB-C 3.2"],"ecosystem":"Android/Samsung","display":"6.8\" Dynamic AMOLED 2X 120Hz","wireless":["Wi-Fi 7","Bluetooth 5.4","UWB"],"health":"Samsung Health"}',
 'Samsung Galaxy S26 Ultra Android smartphone, Samsung Health ecosystem, syncs with Galaxy Watch and Galaxy Buds, Wi-Fi 7, UWB for precision Find My Device, S-Pen, USB-C DisplayPort out.'),
('iPhone 17 Pro Max', 'Apple', 'smartphone', 119900, 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800',
 '{"ram":"8GB","processor":"Apple A19 Pro","os":"iOS 19","ports":["USB-C 3.2 Thunderbolt"],"ecosystem":"Apple","display":"6.9\" ProMotion 120Hz","wireless":["Wi-Fi 7","Bluetooth 5.4","UWB U2"],"health":"Apple Health"}',
 'Apple iPhone 17 Pro Max with Apple Health, deep integration with Apple Watch, AirPods, Mac Continuity, USB-C Thunderbolt for fast file transfer, iOS 19, iCloud, Find My network.'),
('Apple Watch Series 11', 'Apple', 'smartwatch', 49900, 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800',
 '{"ram":"2GB","processor":"Apple S11 SiP","os":"watchOS 12","ecosystem":"Apple","display":"Always-On Retina","wireless":["Wi-Fi 6","Bluetooth 5.4","UWB"],"health":"Apple Health, ECG, SpO2, Temperature","requires":"iPhone with iOS 18+"}',
 'Apple Watch Series 11 smartwatch, requires iPhone, full Apple Health integration, ECG, blood oxygen, temperature, deep iOS ecosystem, does NOT pair with Android phones.'),
('Samsung Galaxy Watch 8 Pro', 'Samsung', 'smartwatch', 44900, 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800',
 '{"ram":"2GB","processor":"Exynos W1000","os":"Wear OS 5","ecosystem":"Android/Samsung","display":"1.5\" Super AMOLED","wireless":["Wi-Fi 6","Bluetooth 5.3","LTE"],"health":"Samsung Health, ECG, BIA, BP","requires":"Android 11+"}',
 'Samsung Galaxy Watch 8 Pro Wear OS smartwatch, full Samsung Health integration with Galaxy phones, body composition, blood pressure, ECG. Pairs best with Android, limited iPhone support.'),
('Google Pixel Watch 3', 'Google', 'smartwatch', 39900, 'https://images.unsplash.com/photo-1551816230-ef5deaed4a26?w=800',
 '{"ram":"2GB","processor":"Snapdragon W5 Gen 1","os":"Wear OS 5","ecosystem":"Google/Fitbit","display":"1.4\" AMOLED","wireless":["Wi-Fi 6","Bluetooth 5.3","LTE"],"health":"Fitbit","requires":"Android 10+"}',
 'Google Pixel Watch 3 Wear OS smartwatch with Fitbit health platform, syncs with any Android phone, Google ecosystem (Google Wallet, Maps, Assistant), no iPhone support.'),
('LG UltraGear 27GR95QE 4K OLED', 'LG', 'monitor', 99900, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800',
 '{"resolution":"3840x2160","refresh":"144Hz","panel":"OLED","ports":["DisplayPort 1.4","HDMI 2.1 x2","USB-C 90W PD"],"hdr":"HDR10","sync":"G-Sync, FreeSync Premium"}',
 'LG UltraGear 27 inch 4K 144Hz OLED monitor, DisplayPort 1.4 and HDMI 2.1, USB-C with 90W power delivery. Works with any laptop supporting DP 1.4 or HDMI 2.1, ideal for MacBook Pro and gaming PCs.'),
('Sony WH-1000XM6 Headphones', 'Sony', 'audio', 39900, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
 '{"driver":"30mm","anc":"Industry-leading","wireless":["Bluetooth 5.3","LE Audio","Multipoint"],"codecs":["LDAC","AAC","SBC","aptX Adaptive"],"battery":"40h"}',
 'Sony WH-1000XM6 over-ear ANC headphones, Bluetooth 5.3 with multipoint, supports LDAC for Android, AAC for iPhone, aptX Adaptive for Windows. Universal compatibility across all ecosystems.'),
('Logitech MX Master 4', 'Logitech', 'accessory', 12900, 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800',
 '{"sensor":"8000 DPI Darkfield","wireless":["Bluetooth LE","Logi Bolt USB"],"compatibility":["Windows","macOS","Linux","iPadOS","Android"],"battery":"70 days","flow":"Multi-device, cross-OS"}',
 'Logitech MX Master 4 wireless mouse, works across Windows, macOS, Linux, iPad, and Android via Bluetooth or Logi Bolt receiver. Flow lets you move between up to 3 computers and copy/paste across operating systems.');
