/* ======================================================================
 * AGEN SUATU - KATALOG PRODUK & PENGATURAN HARGA
 * Lokasi: satu folder dengan index.html dan agen-suatu-sw.js
 *
 * CARA EDIT HARGA:
 * 1. Cari nama produk atau kategori (mis. axis, telkomsel, ml, ff).
 * 2. Ubah angka pada properti `harga` saja (satuan Rupiah, tanpa titik).
 * 3. Label `Rp...` diperbarui otomatis dari nilai `harga`.
 * 4. Untuk markup pulsa, ubah aturan di function genPulsa().
 * 5. Untuk markup e-wallet, ubah penambahan harga di function genEWallet().
 *
 * Jangan menghapus nama properti: name, gb, hari, harga, label, tag.
 * File ini dimuat oleh kedua HTML sebelum kode aplikasi dijalankan.
 * ====================================================================== */
'use strict';

        //PRODUK LENGKAP
function genPulsa() {
  let list = [];
  for (let i = 5; i <= 200; i += 5) {
    let h;
    if (i < 100) {
      h = i + 2; // 5rb - 95rb (Markup +2k)
    } else if (i < 150) {
      h = i + 3; // 100rb - 145rb (Markup +3k)
    } else {
      h = i + 5; // 150rb - 200rb (Markup +5k)
    }

    list.push({
      name: `Pulsa ${i}rb`,
      gb: `${i}rb`,
      hari: "Reguler",
      harga: h * 1000,
      label: `Rp${h}.000`
    });
  }
  return list;
}

function genEWallet(namaEwallet = 'Saldo') {
  let list = [];
  for (let i = 5; i <= 50; i += 5) {
    let harga = (i * 1000) + 3000;
    list.push({ name: `${namaEwallet} ${i}rb`, gb: `${i}rb`, hari: "Topup", harga: harga, label: `Rp${harga.toLocaleString('id-ID')}` });
  }
  return list;
}

var PRODUCTS = {
  ewallet: {
    dana: genEWallet('DANA'),
    gopay: genEWallet('GOPAY'),
    shopeepay: genEWallet('ShopeePay')
  },
  pln: {
    token: [
      { name: "Token PLN 20.000", gb: "20k", hari: "Listrik", harga: 23000, label: "Rp23.000", tag: "Paling Laris" },
      { name: "Token PLN 50.000", gb: "50k", hari: "Listrik", harga: 54000, label: "Rp54.000" },
      { name: "Token PLN 100.000", gb: "100k", hari: "Listrik", harga: 105000, label: "Rp105.000" },
    ]
  },
  telkomsel: {
    pulsa: genPulsa(),
    paket: [
      { name: "4GB 1 Hari (LIST PROMO)", gb: "4GB", hari: "1 Hari", harga: 10000, label: "Rp10.000", tag: "Khusus Promo" },
      { name: "8GB 1 Hari (LIST PROMO)", gb: "8GB", hari: "1 Hari", harga: 12000, label: "Rp12.000", tag: "Khusus promo" },
      { name: "2,5GB 5 Hari", gb: "2,5GB", hari: "5 Hari", harga: 14000, label: "Rp14.000" },
      { name: "3GB 5 Hari", gb: "3GB", hari: "5 Hari", harga: 15000, label: "Rp15.000", tag: "Paling Laris" },
      { name: "5GB 5 Hari", gb: "5GB", hari: "5 Hari", harga: 30000, label: "Rp30.000" }
    ],
    khusus: true // untuk fitur Lihat list paket berdasarkan nomor
  },
  axis: {
    pulsa: genPulsa(),
    harian_3: [
      { name: "10GB 1 Hari", gb: "8GB", hari: "1 Hari", harga: 9000, label: "Rp9.000", tag: "Terjangkau" },
      { name: "Aigo Mini 7,5 GB 2 Hari", gb: "7,5GB", hari: "2 Hari", harga: 12000, label: "Rp12.000" },
      { name: "Mini Axis 8GB + Bonus Aigo 2 Hari", gb: "9GB", hari: "2 Hari", harga: 13000, label: "Rp13.000" },


      { name: "Aigo Mini 6,5GB 3 Hari", gb: "6,5GB", hari: "3 Hari", harga: 15000, label: "Rp15.000", tag: "Hemat" },
      { name: "Paket Harian 7GB+ Lokal 3 Hari", gb: "8GB", hari: "3 Hari", harga: 16000, label: "Rp16.000",},
      { name: "10GB 3 Hari", gb: "10GB", hari: "3 Hari", harga: 17000, label: "Rp17.000", tag: "Naik Harga" },
      { name: "12,5GB 3 Hari", gb: "13GB", hari: "3 Hari", harga: 20000, label: "Rp20.000", tag: "Naik Harga" },
      { name: "Paket Harian 13GB+ Lokal 3 Hari Hari", gb: "15GB", hari: "3 hari", harga: 21000, label: "Rp21.000", tag: "Naik harga"},
      { name: "Mini Axis Aigo Unlimited 24 Jam 1 Hari", gb: "UNLIMITED", hari: "24 JAM", harga: 27000, label: "Rp27.000", tag: "SEPUASNYA"}
    ],
    mini_5: [
      { name: "2GB 5 Hari (promo)", gb: "2GB", hari: "5 Hari", harga: 10000, label: "Rp10.000", tag: "Promo" },
      { name: "Aigo Mini 6GB 5 Hari", gb: "6GB", hari: "5 Hari", harga: 17000, label: "Rp17.000", tag: "Terlaris" },
      { name: "Paket Harian 5,5GB+ Lokal 5 Hari", gb: "7GB", hari: "5 Hari", harga: 17000, label: "Rp17.000" },

      { name: "Aigo Mini 9GB 5 Hari Hari", gb: "9GB", hari: "5 Hari", harga: 18000, label: "Rp18.000", tag: "Nomer Tertentu" },
      { name: "Aigo Mini 9GB 5 Hari Hari", gb: "9GB", hari: "5 Hari", harga: 20000, label: "Rp20.000" },
      { name: "Paket Harian 10GB+ Lokal 5 Hari", gb: "10GB", hari: "5 Hari", harga: 25000, label: "Rp25.000", tag: "Gangguan" },
      { name: "Mini Axis 16GB + Bonus Aigo 5 Hari", gb: "17GB", hari: "5 Hari", harga: 27000, label: "Rp27.000" },
      { name: "Paket Harian 17GB+ Lokal 5 Hari", gb: "24GB", hari: "5 Hari", harga: 30000, label: "Rp30.000" },
      { name: "Aigo Mini 45GB 5 Hari", gb: "45GB", hari: "5 Hari", harga: 37000, label: "Rp37.000" }
    ],
    mini_7: [
      { name: "Mini Axis 4GB + Bonus Aigo 7 Hari", gb: "5,5GB", hari: "7 Hari", harga: 20000, label: "Rp21.000" },
      { name: "Mini Axis 6GB + Bonus Aigo 7 Hari", gb: "8GB", hari: "7 Hari", harga: 23000, label: "Rp23.000" },
    
      { name: "Mini Aigo 16GB 7 Hari", gb: "16GB", hari: "7 Hari", harga: 30000, label: "Rp30.000", tag: "Terlaris" },
      { name: "Axis Bronet 23GB 7 Hari", gb: "20+3GB", hari: "7 Hari", harga: 37000, label: "Rp37.000", tag: "Paling Laris" },
      { name: "Axis Bronet 33 GB 7 Hari", gb: "33GB", hari: "7 Hari", harga: 40000, label: "Rp40.000", tag: "Super Hemat" }
    ],
    mini_14: [
      { name: "Mini Axis 5GB + Bonus Aigo 14 Hari", gb: "6GB", hari: "14 Hari", harga: 25000, label: "Rp25.000" },
      { name: "Mini Aigo 15GB 14 Hari", gb: "13GB", hari: "14 Hari", harga: 37000, label: "Rp40.000" },
      { name: "Mini Axis 15GB + Bonus Aigo 14 Hari", gb: "17GB", hari: "14 Hari", harga: 45000, label: "Rp45.000" },
      { name: "Mini Axis 29GB 14 Hari", gb: "29GB", hari: "14 Hari", harga: 50000, label: "Rp50.000" }
    ],
    bulanan: [
      { name: "Bronet 2GB All 24 Jam 60 Hari", gb: "2GB", hari: "60 Hari", harga: 30000, label: "Rp30.000" },
      { name: "Bronet 3GB + Bonus Aigo 28 Hari", gb: "3GB", hari: "28 Hari", harga: 25000, label: "Rp25.000" },
      { name: "Bronet 7GB 28 Hari", gb: "7GB", hari: "28 Hari", harga: 35000, label: "Rp35.000" },
      { name: "Bronet 10GB 28 Hari", gb: "10GB", hari: "28 Hari", harga: 38000, label: "Rp38.000" },
      { name: "Bronet 15GB 28 Hari", gb: "15GB", hari: "28 Hari", harga: 50000, label: "Rp50.000", tag: "Paling Laris" },
      { name: "Bronet 23GB 28 Hari", gb: "23GB", hari: "28 Hari", harga: 55000, label: "Rp55.000" },
      { name: "Bronet 30GB 28 Hari", gb: "30GB", hari: "28 Hari", harga: 73000, label: "Rp70.000" },
      { name: "Bronet 40GB 28 Hari", gb: "40GB", hari: "28 Hari", harga: 77000, label: "Rp77.000" },
      { name: "Bronet 45GB 28 Hari", gb: "45GB", hari: "28 Hari", harga: 87000, label: "Rp87.000" },
      { name: "Bronet 65GB 28 Hari", gb: "65GB", hari: "28 Hari", harga: 100000, label: "Rp100.000" },
      { name: "Bronet 100GB 28 Hari", gb: "100GB", hari: "28 Hari", harga: 127000, label: "Rp127.000" },
      { name: "Bronet 150GB 28 Hari (promo agen suatu)", gb: "150GB", hari: "28 Hari", harga: 150000, label: "Rp150.000" }
    ]
  },
  xl: {
    pulsa: genPulsa(),
    masa_Aktip: [{ name: "Sebelah kategori pulsa nasional yang harganya 5/6k", gb: "30H", hari: "Masa Aktif", harga: 10000, label: "Rp10.000" }],
    harian_1_14: [
      { name: "Flex Mini 8GB 1 Hari", gb: "8GB", hari: "1 Hari", harga: 10000, label: "Rp10.000" },
      { name: "Flex Mini 15GB 1 Hari", gb: "15GB", hari: "1 Hari", harga: 12000, label: "Rp12.000" },
      { name: "Flex Mini 6GB 2 Hari", gb: "6GB", hari: "2 Hari", harga: 12000, label: "Rp12.000" },
      { name: "Flex Mini 4GB 3 Hari", gb: "4GB", hari: "3 Hari", harga: 14000, label: "Rp14.000" },
      { name: "Flex Mini 4GB 5 Hari", gb: "4GB", hari: "5 Hari", harga: 17000, label: "Rp17.000" },
      { name: "Flex Mini 6GB - 8GB 3 Hari", gb: "6GB", hari: "3 Hari", harga: 16000, label: "Rp16.000" },
      { name: "Flex Mini 4GB - 5GB 7 Hari", gb: "4GB", hari: "7 Hari", harga: 18000, label: "Rp18.000" },
      { name: "Flex Mini 6GB - 8GB 7 Hari", gb: "6GB", hari: "7 Hari", harga: 20000, label: "Rp20.000" },
      { name: "Flex Mini 5GB 14 Hari", gb: "5GB", hari: "14 Hari", harga: 20000, label: "Rp20.000" },
      { name: "Flex Mini 8GB 5 Hari", gb: "8GB", hari: "5 Hari", harga: 20000, label: "Rp20.000" },
      { name: "Flex Mini 7GB 10 Hari", gb: "7GB", hari: "10 Hari", harga: 23000, label: "Rp23.000" },
      { name: "Flex Mini 6,5GB 14 Hari", gb: "6,5GB", hari: "14 Hari", harga: 26000, label: "Rp26.000" },
      { name: "Flex Mini 10GB - 14GB 7 Hari", gb: "14GB", hari: "7 Hari", harga: 26000, label: "Rp26.000" },
      { name: "Flex Mini 9GB 14 Hari", gb: "9GB", hari: "14 Hari", harga: 30000, label: "Rp30.000" },
      { name: "Flex Mini 11GB 10 Hari", gb: "11GB", hari: "10 Hari", harga: 30000, label: "Rp30.000" },
      { name: "Flex Mini 15GB - 20GB 7 Hari", gb: "20GB", hari: "7 Hari", harga: 33000, label: "Rp33.000", tag: "Diskon" },
      { name: "Flex Mini 15GB 14 Hari", gb: "15GB", hari: "14 Hari", harga: 40000, label: "Rp40.000" },
      { name: "Flex Mini 40GB 7 Hari", gb: "40GB", hari: "7 Hari", harga: 42000, label: "Rp42.000", tag: "Super hemat" },
      { name: "Flex Mini 27GB 14 Hari", gb: "27GB", hari: "14 Hari", harga: 50000, label: "Rp50.000", tag: "Terlaris" }
    ],
    bulanan: [
      { name: "XL Data Flex S (5GB - 8GB) + All 5 Menit 28 Hari", gb: "7Gb+Wa", hari: "28 hari", harga: 35000, label: "35.000", tag: "Terhemat"},
      { name: "XL Flex Max 7GB 28 Hari", gb: "7GB", hari: "28 Hari", harga: 36000, label: "Rp36.000" },
      { name: "XL Flex Max 10GB 28 Hari", gb: "10GB", hari: "28 Hari", harga: 45000, label: "Rp45.000" },
      { name: "XL Flex Max 15GB 28 Hari", gb: "15GB", hari: "28 Hari", harga: 50000, label: "Rp50.000", tag: "Paling Laris" },
      { name: "XL Flex Max 22GB 28 Hari", gb: "22GB", hari: "28 Hari", harga: 60000, label: "Rp60.000" },
      { name: "XL Flex Max 28GB 28 Hari", gb: "28GB", hari: "28 Hari", harga: 70000, label: "Rp70.000" },
      { name: "XL Flex Max 75GB 14 Hari", gb: "75GB", hari: "14 Hari", harga: 75000, label: "Rp75.000" },
      { name: "XL Flex Max 36GB 28 Hari", gb: "36GB", hari: "28 Hari", harga: 77000, label: "Rp77.000" },
      { name: "XL Flex Max 46GB 28 Hari", gb: "46GB", hari: "28 Hari", harga: 87000, label: "Rp87.000" },
      { name: "XL Flex Max 65GB 28 Hari", gb: "65GB", hari: "28 Hari", harga: 100000, label: "Rp100.000" },
      { name: "XL Flex Max 100GB 28 Hari", gb: "100GB", hari: "28 Hari", harga: 127000, label: "Rp127.000" },
      { name: "XL Flex Max 150GB 28 Hari (promo agen Suatu)", gb: "150GB", hari: "28 Hari", harga: 155000, label: "Rp155.000" }
    ]
  },
  indosat: {
    pulsa: genPulsa(),
    harian: [
      { name: "Freedom Mini 7GB 1 Hari", gb: "7GB", hari: "1 Hari", harga: 10000, label: "Rp10.000", tag: "Paling Laris" },
      { name: "Freedom Mini 9GB 2 Hari", gb: "5GB", hari: "2 Hari", harga: 14000, label: "Rp14.000" },
      { name: "Freedom Mini 4GB 3 Hari", gb: "4GB", hari: "3 Hari", harga: 15000, label: "Rp15.000" },
      { name: "Freedom Mini 4GB 5 Hari", gb: "4GB", hari: "5 Hari", harga: 16000, label: "Rp17.000" },
      { name: "Freedom Mini 6GB 5 Hari", gb: "6GB", hari: "5 Hari", harga: 18000, label: "Rp18.000", tag: "Paling laris" },
      { name: "Freedom Mini 8GB 5 Hari", gb: "8GB", hari: "5 Hari", harga: 20000, label: "Rp20.000", tag: "Paling laris" },
      { name: "Freedom Mini 10GB 5 Hari", gb: "10GB", hari: "5 Hari", harga: 23000, label: "Rp23.000", tag: "Paling laris" },
      { name: "Freedom Mini 13GB 7 Hari", gb: "13GB", hari: "7 Hari", harga: 25000, label: "Rp25.000", tag: "Murah Meriah" },
      { name: "Freedom Mini 8GB 14 Hari", gb: "8GB", hari: "14 Hari", harga: 30000, label: "Rp30.000" },
      { name: "Freedom Mini 22GB 7 Hari", gb: "22GB", hari: "7 Hari", harga: 33000, label: "Rp33.000", tag: "Super hemat" },
      { name: "Freedom Mini 23GB 7 Hari", gb: "23GB", hari: "7 Hari", harga: 35000, label: "Rp35.000", tag: "Super hemat" },
      { name: "Freedom Mini 30GB 5 Hari", gb: "30GB", hari: "5 Hari", harga: 36000, label: "Rp36.000", tag: "Super hemat" },
      { name: "Freedom Mini 12GB 14 Hari", gb: "12GB", hari: "14 Hari", harga: 37000, label: "Rp37.000" },
      { name: "Freedom Mini 35GB 14 Hari", gb: "35GB", hari: "7 Hari", harga: 50000, label: "Rp50.000", tag: "Hemat" }
    ],
    bulanan: [
      { name: "Freedom Internet 7GB 28 Hari", gb: "7GB", hari: "28 Hari", harga: 35000, label: "Rp35.000" },
      { name: "Freedom Internet 9GB 28 Hari", gb: "9GB", hari: "28 Hari", harga: 40000, label: "Rp40.000" },
      { name: "Freedom Internet 15GB 28 Hari", gb: "15GB", hari: "28 Hari", harga: 50000, label: "Rp50.000", tag: "Paling Laris" },
      { name: "Freedom Internet 22GB 28 Hari", gb: "22GB", hari: "28 Hari", harga: 60000, label: "Rp60.000" },
      { name: "Freedom Internet 28GB 28 Hari", gb: "28GB", hari: "28 Hari", harga: 70000, label: "Rp70.000", tag: "Cocok Untuk hemat" },
      { name: "Freedom Internet 36GB 28 Hari", gb: "36GB", hari: "28 Hari", harga: 77000, label: "Rp77.000" },
      { name: "Freedom Internet 37GB 28 Hari", gb: "37GB", hari: "28 Hari", harga: 80000, label: "Rp80.000" },
      { name: "Freedom Internet Sensasi 50GB 28 Hari", gb: "50GB", hari: "28 Hari", harga: 95000, label: "Rp95.000" },

      { name: "Freedom Internet 70/66GB 28 Hari", gb: "66GB", hari: "28 Hari", harga: 100000, label: "Rp100.000" },
      { name: "Freedom Internet Sensasi 100GB 28 Hari", gb: "100GB", hari: "28hari", harga: 127000, label: "Rp127.000"},
      { name: "Freedom Internet Sensasi 150GB 28 Hari", gb: "150GB", hari: "28 Hari", harga: 155000, label: "Rp155.000", tag: "Super hemat Nonstop" }
    ]
  },
  three: {
    pulsa: genPulsa(),
    harian_1_3: [
      { name: "1GB All + 0,5GB Bonus 3 Hari", gb: "1GB", hari: "3 Hari", harga: 8000, label: "Rp8.000" },
      { name: "Happy 5GB 1 Hari", gb: "5GB", hari: "1 Hari", harga: 9000, label: "Rp9.000" },
      { name: "Happy 6GB 2 Hari", gb: "6GB", hari: "2 Hari", harga: 12000, label: "Rp12.000" },
      { name: "Happy 6GB 3 Hari", gb: "6GB", hari: "3 Hari", harga: 15000, label: "Rp15.000", tag: "Paling Laris" }
    ],
    harian_5: [
      { name: "Happy 7GB 5 Hari", gb: "7GB", hari: "5 Hari", harga: 17000, label: "Rp17.000" },
      { name: "Happy 10GB 5 Hari", gb: "10GB", hari: "5 Hari", harga: 20000, label: "Rp20.000" },
      { name: "Happy 30GB 5 Hari", gb: "30GB", hari: "5 Hari", harga: 32000, label: "Rp32.000" }
    ],
    harian_7: [
      { name: "Happy 6GB 7 Hari", gb: "6GB", hari: "7 Hari", harga: 23000, label: "Rp23.000" },
      { name: "Happy 15GB 7 Hari", gb: "15GB", hari: "7 Hari", harga: 27000, label: "Rp27.000" },
      { name: "Happy 17GB 7 Hari", gb: "17GB", hari: "7 Hari", harga: 32000, label: "Rp32.000" }
    ],
    harian_14: [{ name: "Happy 8GB 14 Hari", gb: "8GB", hari: "14 Hari", harga: 27000, label: "Rp27.000" }],
    aon: [
      { name: "AON 2,5GB + 0,5GB Lokal", gb: "2,5GB", hari: "AON", harga: 25000, label: "Rp25.000" },
      { name: "AON 3,5GB + 1GB Lokal", gb: "3,5GB", hari: "AON", harga: 30000, label: "Rp30.000" },
      { name: "AON 9GB + 3GB Lokal", gb: "9GB", hari: "AON", harga: 50000, label: "Rp50.000" }
    ]
  },
  byu: {
    pulsa: genPulsa(),
    harian: [
      { name: "10GB 1 Hari (List Promo)", gb: "10GB", hari: "1 Hari", harga: 10000, label: "Rp10.000", tag: "Promo" },
      { name: "8GB 3 Hari", gb: "8GB", hari: "3 Hari", harga: 15000, label: "Rp15.000" },
      { name: "5GB 7 Hari", gb: "5GB", hari: "7 Hari", harga: 17000, label: "Rp17.000" },

      { name: "10GB 5 Hari (list promo)", gb: "10GB", hari: "5 Hari", harga: 17000, label: "Rp17.000" },
      { name: "13GB 5 Hari (list promo)", gb: "13GB", hari: "5 Hari", harga: 20000, label: "Rp20.000" },
      { name: "10GB 7 Hari", gb: "10GB", hari: "7 Hari", harga: 25000, label: "Rp25.000" },
      { name: "14GB 7 Hari", gb: "14GB", hari: "7 Hari", harga: 27000, label: "Rp27.000" },
      { name: "12GB 14 Hari", gb: "12GB", hari: "14 Hari", harga: 30000, label: "Rp30.000" },
      { name: "10GB 10 Hari", gb: "10GB", hari: "10 Hari", harga: 35000, label: "Rp35.000" },
      { name: "9GB 14 Hari (list promo)", gb: "9GB", hari: "14 Hari", harga: 27000, label: "Rp27.000" }
    ],
    bulanan: [
      { name: "Kuota By.U 15GB 28 Hari", gb: "15GB", hari: "28 Hari", harga: 55000, label: "Rp55.000" },
      { name: "Kuota By.U 30GB 28 Hari", gb: "30GB", hari: "28 Hari", harga: 77000, label: "Rp77.000" },
      { name: "Kuota By.U 65GB 28 Hari", gb: "65GB", hari: "28 Hari", harga: 102000, label: "Rp102.000" }
    ]
  },
  ml: {
    diamond: [
      { name: "3 Diamond Mobile Legends", gb: "3💎", hari: "Instan", harga: 2000, label: "Rp2.000" },
      { name: "5 Diamond Mobile Legends", gb: "5💎", hari: "Instan", harga: 3000, label: "Rp3.000" },
      { name: "12 Diamond Mobile Legends", gb: "12💎", hari: "Instan", harga: 5000, label: "Rp5.000" },
      { name: "15 Diamond Mobile Legends", gb: "15💎", hari: "Instan", harga: 7000, label: "Rp7.000" },
      { name: "19 Diamond Mobile Legends", gb: "19💎", hari: "Instan", harga: 8000, label: "Rp8.000" },
      { name: "28 Diamond Mobile Legends", gb: "28💎", hari: "Instan", harga: 10000, label: "Rp10.000" },
      { name: "36 Diamond Mobile Legends", gb: "36💎", hari: "Instan", harga: 14000, label: "Rp14.000" },
      { name: "44 Diamond Mobile Legends", gb: "44💎", hari: "Instan", harga: 15000, label: "Rp15.000" },
      { name: "56 Diamond Mobile Legends", gb: "56💎", hari: "Instan", harga: 19000, label: "Rp19.000" },
      { name: "59 Diamond Mobile Legends", gb: "59💎", hari: "Instan", harga: 20000, label: "Rp20.000" },
      { name: "74 Diamond Mobile Legends", gb: "74💎", hari: "Instan", harga: 24000, label: "Rp24.000" },
      { name: "85 Diamond Mobile Legends", gb: "85💎", hari: "Instan", harga: 26000, label: "Rp26.000", tag: "Paling Laris" },
      { name: "100 Diamond Mobile Legends", gb: "100💎", hari: "Instan", harga: 32000, label: "Rp32.000" },
      { name: "112 Diamond Mobile Legends", gb: "112💎", hari: "Instan", harga: 37000, label: "Rp37.000" },
      { name: "144 Diamond Mobile Legends", gb: "144💎", hari: "Instan", harga: 45000, label: "Rp45.000" },
      { name: "170 Diamond Mobile Legends", gb: "170💎", hari: "Instan", harga: 55000, label: "Rp55.000" },
      { name: "185 Diamond Mobile Legends", gb: "185💎", hari: "Instan", harga: 57000, label: "Rp57.000" },
      { name: "222 Diamond Mobile Legends", gb: "222💎", hari: "Instan", harga: 67000, label: "Rp67.000" },
      { name: "240 Diamond Mobile Legends", gb: "240💎", hari: "Instan", harga: 65000, label: "Rp65.000" },
      { name: "257 Diamond Mobile Legends", gb: "257💎", hari: "Instan", harga: 72000, label: "Rp72.000" },
      { name: "284 Diamond Mobile Legends", gb: "284💎", hari: "Instan", harga: 85000, label: "Rp85.000" },
      { name: "296 Diamond Mobile Legends", gb: "296💎", hari: "Instan", harga: 87000, label: "Rp87.000" },
      { name: "301 Diamond Mobile Legends", gb: "301💎", hari: "Instan", harga: 92000, label: "Rp92.000" },
      { name: "345 Diamond Mobile Legends", gb: "345💎", hari: "Instan", harga: 105000, label: "Rp105.000" },
      { name: "355 Diamond Mobile Legends", gb: "355💎", hari: "Instan", harga: 107000, label: "Rp107.000" }
    ],
    wdp: [
      { name: "Weekly Diamond Pass 1x", gb: "WDP 1x", hari: "Pass", harga: 35000, label: "Rp35.000", tag: "Paling Laris" },
      { name: "Weekly Diamond Pass 2x", gb: "WDP 2x", hari: "Pass", harga: 75000, label: "Rp75.000" },
      { name: "Weekly Diamond Pass 3x", gb: "WDP 3x", hari: "Pass", harga: 105000, label: "Rp105.000" },
      { name: "Weekly Diamond Pass 4x", gb: "WDP 4x", hari: "Pass", harga: 140000, label: "Rp140.000" },
      { name: "Weekly Diamond Pass 5x", gb: "WDP 5x", hari: "Pass", harga: 175000, label: "Rp175.000" }
    ]
  },
  ff: {
    diamond: [
      { name: "5 Diamond Free Fire", gb: "5💎", hari: "Instan", harga: 2000, label: "Rp2.000" },
      { name: "10 Diamond Free Fire", gb: "10💎", hari: "Instan", harga: 3000, label: "Rp3.000" },
      { name: "12 Diamond Free Fire", gb: "12💎", hari: "Instan", harga: 4000, label: "Rp4.000" },
      { name: "20 Diamond Free Fire", gb: "20💎", hari: "Instan", harga: 5000, label: "Rp5.000" },
      { name: "30 Diamond Free Fire", gb: "30💎", hari: "Instan", harga: 6000, label: "Rp6.000" },
      { name: "40 Diamond Free Fire", gb: "40💎", hari: "Instan", harga: 7000, label: "Rp7.000" },
      { name: "50 Diamond Free Fire", gb: "50💎", hari: "Instan", harga: 8000, label: "Rp8.000" },
      { name: "55 Diamond Free Fire", gb: "55💎", hari: "Instan", harga: 9000, label: "Rp9.000" },
      { name: "70 Diamond Free Fire", gb: "70💎", hari: "Instan", harga: 10000, label: "Rp10.000", tag: "Paling Laris" },
      { name: "75 Diamond Free Fire", gb: "75💎", hari: "Instan", harga: 11000, label: "Rp11.000" },
      { name: "80 Diamond Free Fire", gb: "80💎", hari: "Instan", harga: 12000, label: "Rp12.000" },
      { name: "90 Diamond Free Fire", gb: "90💎", hari: "Instan", harga: 14000, label: "Rp14.000" },
      { name: "100 Diamond Free Fire", gb: "100💎", hari: "Instan", harga: 15000, label: "Rp15.000" },
      { name: "120 Diamond Free Fire", gb: "120💎", hari: "Instan", harga: 18000, label: "Rp18.000" },
      { name: "140 Diamond Free Fire", gb: "140💎", hari: "Instan", harga: 19000, label: "Rp19.000" },
      { name: "150 Diamond Free Fire", gb: "150💎", hari: "Instan", harga: 20000, label: "Rp20.000" },
      { name: "160 Diamond Free Fire", gb: "160💎", hari: "Instan", harga: 22000, label: "Rp22.000" },
      { name: "190 Diamond Free Fire", gb: "190💎", hari: "Instan", harga: 28000, label: "Rp28.000" },
      { name: "200 Diamond Free Fire", gb: "200💎", hari: "Instan", harga: 29000, label: "Rp29.000" },
      { name: "210 Diamond Free Fire", gb: "210💎", hari: "Instan", harga: 30000, label: "Rp30.000" },
      { name: "250 Diamond Free Fire", gb: "250💎", hari: "Instan", harga: 35000, label: "Rp35.000" },
      { name: "300 Diamond Free Fire", gb: "300💎", hari: "Instan", harga: 40000, label: "Rp40.000" },
      { name: "355 Diamond Free Fire", gb: "355💎", hari: "Instan", harga: 47000, label: "Rp47.000" },
      { name: "375 Diamond Free Fire", gb: "375💎", hari: "Instan", harga: 50000, label: "Rp50.000" },
      { name: "405 Diamond Free Fire", gb: "405💎", hari: "Instan", harga: 55000, label: "Rp55.000" },
      { name: "425 Diamond Free Fire", gb: "425💎", hari: "Instan", harga: 60000, label: "Rp60.000" },
      { name: "475 Diamond Free Fire", gb: "475💎", hari: "Instan", harga: 65000, label: "Rp65.000" },
      { name: "510 Diamond Free Fire", gb: "510💎", hari: "Instan", harga: 70000, label: "Rp70.000" },
      { name: "545 Diamond Free Fire", gb: "545💎", hari: "Instan", harga: 75000, label: "Rp75.000" },
      { name: "565 Diamond Free Fire", gb: "565💎", hari: "Instan", harga: 80000, label: "Rp80.000" },
      { name: "635 Diamond Free Fire", gb: "635💎", hari: "Instan", harga: 85000, label: "Rp85.000" },
      { name: "720 Diamond Free Fire", gb: "720💎", hari: "Instan", harga: 95000, label: "Rp95.000" },
      { name: "770 Diamond Free Fire", gb: "770💎", hari: "Instan", harga: 100000, label: "Rp100.000" },
      { name: "790 Diamond Free Fire", gb: "790💎", hari: "Instan", harga: 105000, label: "Rp105.000" },
      { name: "800 Diamond Free Fire", gb: "800💎", hari: "Instan", harga: 110000, label: "Rp110.000" },
      { name: "860 Diamond Free Fire", gb: "860💎", hari: "Instan", harga: 120000, label: "Rp120.000" },
      { name: "930 Diamond Free Fire", gb: "930💎", hari: "Instan", harga: 130000, label: "Rp130.000" },
      { name: "1000 Diamond Free Fire", gb: "1000💎", hari: "Instan", harga: 150000, label: "Rp150.000" },
      { name: "1450 Diamond Free Fire", gb: "1450💎", hari: "Instan", harga: 200000, label: "Rp200.000" }
    ],
    membership: [{ name: "Membership Level Up Pass - Level 30", gb: "MEMBER", hari: "30 Hari", harga: 15000, label: "Rp15.000" }]
  }
};

// Sinkronkan seluruh label dengan harga angka agar harga kartu, checkout,
// dan informasi produk tidak menampilkan nominal yang berbeda.
function formatLabelHargaProduk(nominal) {
  const angka = Number(nominal);
  if (!Number.isFinite(angka) || angka < 0) return 'Rp0';
  return `Rp${Math.round(angka).toLocaleString('id-ID')}`;
}

function sinkronkanLabelHargaProduk(katalog) {
  if (Array.isArray(katalog)) {
    katalog.forEach(item => {
      if (!item || typeof item !== 'object') return;
      if (Object.prototype.hasOwnProperty.call(item, 'harga')) {
        item.label = formatLabelHargaProduk(item.harga);
      } else {
        sinkronkanLabelHargaProduk(item);
      }
    });
    return;
  }
  if (katalog && typeof katalog === 'object') {
    Object.values(katalog).forEach(sinkronkanLabelHargaProduk);
  }
}

sinkronkanLabelHargaProduk(PRODUCTS);
window.PRODUCTS = PRODUCTS;
