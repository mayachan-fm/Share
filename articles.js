// Stage P7 — Kumpulan artikel singkat untuk Download Gate.
// Konten ini hanya digunakan sebagai artikel pengantar sebelum download.
export const ARTIKEL_DOWNLOAD = [
  {
    judul: 'Tips Menjaga Dunia Minecraft Tetap Aman',
    isi: 'Sebelum memasang addon, sebaiknya buat salinan dunia terlebih dahulu. Backup sederhana dapat membantu menghindari kehilangan progres jika addon tidak kompatibel dengan dunia yang sedang dimainkan.'
  },
  {
    judul: 'Kenapa Versi Minecraft Perlu Diperhatikan?',
    isi: 'Setiap addon dibuat untuk versi Minecraft tertentu. Periksa informasi versi pada halaman addon agar fitur, item, dan perilaku addon sesuai dengan versi Bedrock yang kamu gunakan.'
  },
  {
    judul: 'Gunakan Addon dari Sumber yang Kamu Percaya',
    isi: 'Addon dapat menambahkan banyak hal ke Minecraft. Sebelum menggunakannya, periksa deskripsi, versi, ukuran file, dan sumber download. Hindari menjalankan file yang tidak kamu kenali.'
  },
  {
    judul: 'Backup Sebelum Mencoba Addon Baru',
    isi: 'Backup dunia adalah langkah sederhana yang berguna ketika mencoba addon baru. Simpan salinan dunia sebelum mengaktifkan addon yang mengubah gameplay, struktur, atau sistem dunia.'
  },
  {
    judul: 'Addon dan Resource Pack Itu Berbeda',
    isi: 'Addon biasanya mengubah perilaku atau menambahkan konten, sedangkan resource pack terutama mengubah tampilan dan suara. Memahami perbedaannya membantu kamu memilih file yang sesuai kebutuhan.'
  },
  {
    judul: 'Perhatikan Ukuran File',
    isi: 'Ukuran file dapat memberi gambaran awal tentang banyaknya aset yang dibawa sebuah addon. File yang lebih besar tidak selalu berarti lebih baik, tetapi ukuran tetap berguna untuk mengetahui kebutuhan penyimpanan.'
  },
  {
    judul: 'Cek Deskripsi Sebelum Download',
    isi: 'Deskripsi addon biasanya menjelaskan fitur utama, kompatibilitas, dan batasan. Membacanya terlebih dahulu dapat mengurangi kemungkinan memasang addon yang tidak sesuai dengan gaya bermainmu.'
  },
  {
    judul: 'Jaga Dunia Utama Tetap Aman',
    isi: 'Jika ingin bereksperimen dengan banyak addon, gunakan salinan dunia khusus untuk pengujian. Dengan begitu, dunia utama tetap terpisah dari eksperimen yang mungkin menimbulkan konflik.'
  }
];

export function ambilArtikelAcak() {
  return ARTIKEL_DOWNLOAD[Math.floor(Math.random() * ARTIKEL_DOWNLOAD.length)];
}
