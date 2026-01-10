import { useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';

const SlideshowView = () => {
    const config = useConfig();

    useEffect(() => {
        // EXACT LOGIC FROM ORIGINAL HTML - NO MODIFICATIONS (mostly)
        const API_BASE = import.meta.env.VITE_API_BASE_URL || '/.netlify/functions';
        const GOOGLE_SCRIPT_JADWAL_URL = `${API_BASE}/getDoctors`;
        const GOOGLE_SCRIPT_CUTI_URL = `${API_BASE}/getLeaveData`;
        const PROMO_DATA_API_URL = `${API_BASE}/getPromoImages`;

        const VIDEO_URLS = ['video/promo.mp4', 'video/promo2.mp4'];

        const SLIDE_DURATION = 10000;
        const PROMO_SLIDE_DURATION = 15000;
        const DATA_REFRESH_INTERVAL = (config.refreshInterval || 24) * 60 * 60 * 1000;

        const doctorNameElement = document.getElementById('doctor-name');
        const doctorSpecialtyElement = document.getElementById('doctor-specialty');
        const doctorPhotoElement = document.getElementById('doctor-photo');
        const scheduleWrapper = document.getElementById('schedule-wrapper');
        const scheduleHeadElement = document.getElementById('schedule-head');
        const scheduleBodyElement = document.getElementById('schedule-body');
        const cutiTickerContentElement = document.getElementById('cuti-ticker-content');
        const slideshowContainer = document.getElementById('slideshow-container');
        const videoContainer = document.getElementById('video-container');
        const promoVideoElement = document.getElementById('promo-video');
        const promoContainer = document.getElementById('promo-container');
        const promoFullscreenImage = document.getElementById('promo-fullscreen-image');

        let doctorsData = [];
        let promoData = [];
        let currentSlideIndex = 0;
        let currentVideoIndex = 0;
        let currentPromoIndex = 0;
        let slideshowInterval;

        function formatDisplayDate(dateString) {
            if (!dateString) { return 'Tanggal tidak tersedia'; }
            const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            let objekTanggal;
            const bagian = String(dateString).split('-');
            if (bagian.length === 3) {
                objekTanggal = new Date(bagian[2], bagian[1] - 1, bagian[0]);
            } else { return dateString; }
            if (isNaN(objekTanggal.getTime())) { return dateString; }
            return objekTanggal.getDate() + ' ' + namaBulan[objekTanggal.getMonth()] + ' ' + objekTanggal.getFullYear();
        }

        async function ambilDataApi(url) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('Pengambilan API gagal: ' + response.statusText);
                }
                return await response.json();
            } catch (error) {
                console.error('Error mengambil data dari ' + url + ':', error);
                return null;
            }
        }

        function createKey(name) {
            if (typeof name !== 'string') return '';
            return name.toLowerCase()
                .replace(/spesialis|sub|dokter|gigi|&/g, '')
                .replace(/,/g, '')
                .replace(/\\(|\\)/g, '')
                .trim()
                .replace(/\\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
        }

        function ubahDataJadwal(dataJson) {
            const semuaDokter = [];
            const specialtyCustomOrder = [
                'anak', 'kandungan', 'penyakit-dalam', 'mata', 'urologi', 'saraf', 'tht', 'paru',
                'bedah-saraf', 'jantung', 'rehab-medik', 'kulit-kelamin', 'bedah', 'jiwa',
                'bedah-toraks', 'gigi-umum', 'bedah-mulut', 'konservasi-gigi', 'penyakit-mulut',
                'prostodonsia', 'ortopedi', 'kandungan-onkologi', 'kandungan-fetomaternal',
                'penyakit-dalam-ginjal', 'bedah-onkologi',
                'umum', 'medical-check-up'
            ];
            for (const kunciSpesialis in dataJson) {
                const spesialis = dataJson[kunciSpesialis];
                spesialis.doctors.forEach(function (dokter) {
                    if (dokter.schedule && Object.keys(dokter.schedule).length > 0) {
                        const fotoSSTV = dokter.image_url_sstv || dokter.image_url;
                        semuaDokter.push({
                            nama: dokter.name,
                            spesialis: spesialis.title,
                            fotourl: fotoSSTV || 'https://placehold.co/400x500/ffffff/334155?text=Foto+Tidak+Tersedia&bg-opacity=0',
                            schedule: dokter.schedule
                        });
                    }
                });
            }
            semuaDokter.sort((a, b) => {
                const keyA = createKey(a.spesialis);
                const keyB = createKey(b.spesialis);
                let indexA = specialtyCustomOrder.indexOf(keyA);
                let indexB = specialtyCustomOrder.indexOf(keyB);
                if (indexA === -1) indexA = Infinity;
                if (indexB === -1) indexB = Infinity;
                if (indexA !== indexB) {
                    return indexA - indexB;
                }
                return a.nama.localeCompare(b.nama);
            });
            return semuaDokter;
        }

        function preloadGambarDokter(data) {
            if (!data) return;
            data.forEach(function (dokter) {
                if (dokter.fotourl) {
                    new Image().src = dokter.fotourl;
                }
            });
        }

        function preloadGambarPromo(data) {
            if (!data) return;
            data.forEach(function (promo) {
                if (promo.imageUrl && !promo.imageUrl.includes('placehold.co')) {
                    new Image().src = promo.imageUrl;
                }
            });
        }

        function formatJadwal(scheduleObj) {
            if (!scheduleObj || Object.keys(scheduleObj).length === 0) {
                return null;
            }
            let headerHtml = '<tr>';
            let bodyHtml = '<tr>';
            const daysOrder = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
            let hasValidSchedule = false;
            for (const day of daysOrder) {
                const scheduleData = scheduleObj[day];
                let scheduleTime = null;
                if (typeof scheduleData === 'string') {
                    scheduleTime = scheduleData;
                } else if (typeof scheduleData === 'object' && scheduleData !== null && scheduleData.jam) {
                    scheduleTime = scheduleData.jam;
                }
                if (scheduleTime && scheduleTime.trim() !== '-' && scheduleTime.trim() !== '') {
                    const timeSlots = scheduleTime.split('/').map(slot => slot.trim()).join('<br>');
                    headerHtml += `<th >${day.charAt(0).toUpperCase() + day.slice(1)}</th>`;
                    bodyHtml += `<td>${timeSlots}</td>`;
                    hasValidSchedule = true;
                }
            }
            headerHtml += '</tr>';
            bodyHtml += '</tr>';
            return hasValidSchedule ? { header: headerHtml, body: bodyHtml } : null;
        }

        function perbaruiSlideDokter() {
            if (doctorsData.length === 0) return;
            if (currentSlideIndex >= doctorsData.length) {
                currentSlideIndex = 0;
            }
            const dokter = doctorsData[currentSlideIndex];
            if (doctorNameElement) doctorNameElement.textContent = dokter.nama || 'Nama Tidak Tersedia';
            if (doctorSpecialtyElement) doctorSpecialtyElement.textContent = dokter.spesialis || 'Spesialis Tidak Tersedia';
            if (doctorPhotoElement) {
                doctorPhotoElement.src = dokter.fotourl;
                doctorPhotoElement.onerror = function () {
                    doctorPhotoElement.src = 'https://placehold.co/400x500/ffffff/334155?text=Gagal+Muat&bg-opacity=0';
                };
            }
            const jadwal = formatJadwal(dokter.schedule);
            if (jadwal && scheduleHeadElement && scheduleBodyElement) {
                scheduleHeadElement.innerHTML = jadwal.header;
                scheduleBodyElement.innerHTML = jadwal.body;
                if (scheduleWrapper) scheduleWrapper.style.display = 'block';
            } else if (scheduleHeadElement && scheduleBodyElement) {
                scheduleHeadElement.innerHTML = '';
                scheduleBodyElement.innerHTML = '';
                if (scheduleWrapper) scheduleWrapper.style.display = 'none';
            }
        }

        function perbaruiSlidePromo() {
            if (promoData.length === 0) {
                mulaiUlangSiklus();
                return;
            }
            if (currentPromoIndex >= promoData.length) {
                mulaiUlangSiklus();
                return;
            }
            const promo = promoData[currentPromoIndex];
            if (promoFullscreenImage) {
                promoFullscreenImage.src = promo.imageUrl;
                promoFullscreenImage.alt = promo.altText;
                promoFullscreenImage.onerror = function () {
                    promoFullscreenImage.src = 'https://placehold.co/1920x1080/1e3a8a/ffffff?text=Gambar+Promo+Tidak+Tersedia';
                };
            }
            if (promoContainer) {
                promoContainer.style.display = 'flex';
                promoContainer.style.opacity = '1';
                promoContainer.classList.remove('fade-in');
            }
        }

        function mulaiSlideshowDokter() {
            if (!doctorsData || doctorsData.length === 0) {
                if (doctorNameElement) {
                    doctorNameElement.innerHTML = `
                        Gagal memuat data dokter.<br>
                        <span class="text-green-600 text-lg">Periksa kembali koneksi ke API.</span>
                    `;
                }
                if (slideshowInterval) clearInterval(slideshowInterval);
                setTimeout(mulaiUlangSiklus, 5000);
                return;
            }

            if (slideshowContainer) slideshowContainer.style.display = 'flex';
            if (videoContainer) videoContainer.style.display = 'none';
            if (promoContainer) promoContainer.style.display = 'none';
            if (promoVideoElement) promoVideoElement.pause();

            perbaruiSlideDokter();

            if (slideshowInterval) clearInterval(slideshowInterval);
            slideshowInterval = setInterval(function () {
                currentSlideIndex++;
                if (currentSlideIndex >= doctorsData.length) {
                    clearInterval(slideshowInterval);
                    mulaiSlideshowPromo();
                } else {
                    perbaruiSlideDokter();
                }
            }, SLIDE_DURATION);
        }

        function mulaiSlideshowPromo() {
            if (!promoData || promoData.length === 0) {
                mulaiUlangSiklus();
                return;
            }

            if (slideshowContainer) slideshowContainer.style.display = 'none';
            if (videoContainer) videoContainer.style.display = 'none';
            if (promoContainer) promoContainer.style.display = 'flex';

            perbaruiSlidePromo();

            setTimeout(function () {
                currentPromoIndex++;
                if (currentPromoIndex >= promoData.length) {
                    mulaiUlangSiklus();
                } else {
                    mulaiSlideshowPromo();
                }
            }, PROMO_SLIDE_DURATION);
        }

        function putarVideoBerikutnya() {
            mulaiUlangSiklus();
        }

        function mulaiUlangSiklus() {
            currentSlideIndex = 0;
            currentVideoIndex = 0;
            currentPromoIndex = 0;
            if (promoVideoElement) {
                promoVideoElement.pause();
                promoVideoElement.src = "";
            }
            setTimeout(mulaiSlideshowDokter, 100);
        }

        if (promoVideoElement) {
            promoVideoElement.onended = function () {
                currentVideoIndex++;
                if (currentVideoIndex < VIDEO_URLS.length) {
                    putarVideoBerikutnya();
                } else {
                    mulaiUlangSiklus();
                }
            };
            promoVideoElement.onerror = function () {
                console.error('Video error. Skipping.');
                currentVideoIndex++;
                if (currentVideoIndex < VIDEO_URLS.length) {
                    putarVideoBerikutnya();
                } else {
                    mulaiUlangSiklus();
                }
            };
        }

        async function aturTickerCuti() {
            try {
                const dataCuti = await ambilDataApi(GOOGLE_SCRIPT_CUTI_URL);

                if (dataCuti && dataCuti.length > 0 && cutiTickerContentElement) {
                    const teksCuti = dataCuti.map(function (item) {
                        const nama = item.NamaDokter || '';
                        const mulai = item.TanggalMulaiCuti || '';
                        const selesai = item.TanggalSelesaiCuti || '';
                        const mulaiFormatted = formatDisplayDate(mulai);
                        const selesaiFormatted = formatDisplayDate(selesai);
                        let infoTanggal = '';
                        if (mulaiFormatted && selesaiFormatted && mulaiFormatted !== selesaiFormatted) {
                            infoTanggal = 'dari <strong style="color: #DC2626;">' + mulaiFormatted + '</strong> sampai <strong style="color: #DC2626;">' + selesaiFormatted + '</strong>';
                        } else if (mulaiFormatted) {
                            infoTanggal = 'pada tanggal <strong style="color: #DC2626;">' + mulaiFormatted + '</strong>';
                        }
                        return '<span class="info-cuti-label">[INFO CUTI]</span> <strong>' + nama + '</strong> tidak praktek ' + infoTanggal;
                    }).join('<span class="mx-6 opacity-60">|</span>');

                    cutiTickerContentElement.innerHTML = teksCuti;
                } else if (cutiTickerContentElement) {
                    cutiTickerContentElement.textContent = 'Tidak ada informasi cuti saat ini.';
                }
            } catch (error) {
                console.error('Error dalam aturTickerCuti:', error);
                if (cutiTickerContentElement) cutiTickerContentElement.textContent = 'Error memuat informasi cuti.';
            }
        }

        async function perbaruiData() {
            console.log('[' + new Date().toLocaleTimeString() + '] Memeriksa pembaruan data...');
            const [dataJadwal, dataPromo, dataCuti] = await Promise.all([
                ambilDataApi(GOOGLE_SCRIPT_JADWAL_URL),
                ambilDataApi(PROMO_DATA_API_URL),
                ambilDataApi(GOOGLE_SCRIPT_CUTI_URL)
            ]);

            if (dataJadwal) {
                const dataBaru = ubahDataJadwal(dataJadwal);
                if (JSON.stringify(doctorsData) !== JSON.stringify(dataBaru)) {
                    console.log('Data dokter berubah, memuat ulang.');
                    doctorsData = dataBaru;
                    preloadGambarDokter(doctorsData);
                }
            }

            if (dataPromo) {
                if (JSON.stringify(promoData) !== JSON.stringify(dataPromo)) {
                    console.log('Data promo berubah, memuat ulang.');
                    promoData = dataPromo;
                    preloadGambarPromo(promoData);
                }
            }

            if (dataCuti) {
                const teksCuti = dataCuti.map(function (item) {
                    const nama = item.NamaDokter || '';
                    const mulai = item.TanggalMulaiCuti || '';
                    const selesai = item.TanggalSelesaiCuti || '';
                    const mulaiFormatted = formatDisplayDate(mulai);
                    const selesaiFormatted = formatDisplayDate(selesai);
                    let infoTanggal = '';
                    if (mulaiFormatted && selesaiFormatted && mulaiFormatted !== selesaiFormatted) {
                        infoTanggal = 'dari <strong style="color: #DC2626;">' + mulaiFormatted + '</strong> sampai <strong style="color: #DC2626;">' + selesaiFormatted + '</strong>';
                    } else if (mulaiFormatted) {
                        infoTanggal = 'pada tanggal <strong style="color: #DC2626;">' + mulaiFormatted + '</strong>';
                    }
                    return '<span class="info-cuti-label">[INFO CUTI]</span> <strong>' + nama + '</strong> tidak praktek ' + infoTanggal.trim();
                }).join('<span class="mx-6 opacity-60">|</span>');

                if (teksCuti && cutiTickerContentElement) {
                    cutiTickerContentElement.innerHTML = teksCuti;
                } else if (cutiTickerContentElement) {
                    cutiTickerContentElement.textContent = 'Tidak ada informasi cuti saat ini.';
                }
            } else if (cutiTickerContentElement) {
                cutiTickerContentElement.textContent = 'Error memuat informasi cuti.';
            }
        }

        async function inisialisasi() {
            const [dataJadwal, dataPromo, dataCuti] = await Promise.all([
                ambilDataApi(GOOGLE_SCRIPT_JADWAL_URL),
                ambilDataApi(PROMO_DATA_API_URL),
                ambilDataApi(GOOGLE_SCRIPT_CUTI_URL)
            ]);

            if (dataJadwal) {
                doctorsData = ubahDataJadwal(dataJadwal);
            }

            if (dataPromo) {
                promoData = dataPromo;
            }

            if (dataCuti) {
                if (dataCuti.length > 0) {
                    const teksCuti = dataCuti.map(function (item) {
                        const nama = item.NamaDokter || '';
                        const mulai = item.TanggalMulaiCuti || '';
                        const selesai = item.TanggalSelesaiCuti || '';
                        const mulaiFormatted = formatDisplayDate(mulai);
                        const selesaiFormatted = formatDisplayDate(selesai);
                        let infoTanggal = '';
                        if (mulaiFormatted && selesaiFormatted && mulaiFormatted !== selesaiFormatted) {
                            infoTanggal = 'dari <strong style="color: #DC2626;">' + mulaiFormatted + '</strong> sampai <strong style="color: #DC2626;">' + selesaiFormatted + '</strong>';
                        } else if (mulaiFormatted) {
                            infoTanggal = 'pada tanggal <strong style="color: #DC2626;">' + mulaiFormatted + '</strong>';
                        }
                        return '<span class="info-cuti-label">[INFO CUTI]</span> <strong>' + nama + '</strong> tidak praktek ' + infoTanggal;
                    }).join('<span class="mx-6 opacity-60">|</span>');

                    if (cutiTickerContentElement) cutiTickerContentElement.innerHTML = teksCuti;
                } else if (cutiTickerContentElement) {
                    cutiTickerContentElement.textContent = 'Tidak ada informasi cuti saat ini.';
                }
            } else if (cutiTickerContentElement) {
                cutiTickerContentElement.textContent = 'Error memuat informasi cuti.';
            }

            preloadGambarDokter(doctorsData);
            preloadGambarPromo(promoData);

            mulaiSlideshowDokter();
            setInterval(perbaruiData, DATA_REFRESH_INTERVAL);
        }

        // --- HEARTBEAT & REMOTE REFRESH (NEW) ---
        const HEARTBEAT_INTERVAL = 30000; // 30 seconds
        const HEARTBEAT_URL = `${API_BASE}/device-heartbeat`;

        // Use persistent device ID if possible, otherwise generate one
        let deviceId = localStorage.getItem('slideshow_device_id');
        if (!deviceId) {
            deviceId = 'TV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            localStorage.setItem('slideshow_device_id', deviceId);
        }

        const sendHeartbeat = async () => {
            try {
                const currentDoctor = doctorsData[currentSlideIndex]?.nama || 'Unknown';
                const response = await fetch(HEARTBEAT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: deviceId,
                        status: 'online',
                        currentSlide: currentDoctor,
                        browserInfo: navigator.userAgent
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.refresh) {
                        console.log('Remote refresh command received!');
                        window.location.reload();
                    }
                }
            } catch (error) {
                console.warn('Heartbeat failed:', error);
            }
        };

        const heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
        sendHeartbeat(); // Initial heartbeat
        // ----------------------------------------

        inisialisasi();

        // Cleanup
        return () => {
            if (slideshowInterval) clearInterval(slideshowInterval);
            if (heartbeatTimer) clearInterval(heartbeatTimer);
        };
    }, []);

    return (
        <div className="flex flex-col h-screen">
            {/* Header */}
            <header className="p-4 md:p-6 flex justify-start">
                <img src={config.hospitalLogo} alt="Logo Perusahaan" className="h-12 w-auto" />
            </header>

            {/* Main Content */}
            <main className="flex-grow flex items-center justify-center p-4 md:p-8 -mt-16" style={{ position: 'relative', zIndex: 10 }}>

                {/* Slideshow Container */}
                <div id="slideshow-container" className="w-full flex-grow relative flex items-center justify-center">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center w-full max-w-7xl">
                        <div className="flex flex-col md:col-span-3">
                            <div className="bg-blue-900 text-white py-3 px-6 rounded-lg shadow-lg self-start mb-6">
                                <h1 className="text-2xl font-bold">Jadwal Praktek Dokter</h1>
                            </div>
                            <h2 id="doctor-name" className="text-4xl font-bold text-gray-800">Memuat Nama Dokter...</h2>
                            <p id="doctor-specialty" className="text-2xl text-green-700 font-semibold mt-1">Memuat Spesialis...</p>

                            <div id="schedule-wrapper" className="mt-8 w-full flex justify-center">
                                <div className="schedule-table-wrapper inline-block">
                                    <table id="schedule-table" className="schedule-table">
                                        <thead id="schedule-head"></thead>
                                        <tbody id="schedule-body"></tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center gap-4">
                                <img src={config.hospitalLogo2} alt="Logo MySiloam" className="h-14 w-auto" />
                            </div>
                        </div>
                        <div className="flex items-center justify-center h-full md:col-span-2 fade-bottom">
                            <img id="doctor-photo" src="https://placehold.co/400x500/ffffff/334155?text=Foto+Dokter&bg-opacity=0" alt="Foto Dokter" className="object-contain w-full h-auto max-h-[80vh]" />
                        </div>
                    </div>
                </div>

                {/* Video Container */}
                <div id="video-container" className="hidden w-full h-full flex-grow flex items-center justify-center">
                    <video id="promo-video" className="w-full h-full max-h-[80vh] object-contain rounded-lg" playsInline></video>
                </div>

                {/* Promo Container */}
                <div id="promo-container" className="hidden promo-fullscreen-container">
                    <img id="promo-fullscreen-image" src="" alt="Gambar Promo" className="promo-fullscreen-image" />
                </div>
            </main>

            {/* Cuti Ticker */}
            <div id="cuti-ticker-container" className="ticker-wrap">
                <div className="ticker-move">
                    <div id="cuti-ticker-content" className="ticker-item">Memuat informasi cuti...</div>
                </div>
            </div>
        </div>
    );
};

export default SlideshowView;
