// --- Cấu Hình File EPUB ---
// Dùng encodeURI để không bị lỗi do khoảng trắng và tiếng Việt có dấu
const EPUB_FILE = encodeURI("Thì Ra Ta Là Tuyệt Thế Võ Thần - Phong Lăng Bắc.epub");
const STORAGE_PREFIX = "epub_vo_than_"; 

let book;
let rendition;
let currentLocationCfi = "";
let currentChapterName = "Đang đọc...";
let savedBookmarks = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'bookmarks') || '[]');

window.onload = () => {
    book = ePub(EPUB_FILE);
    rendition = book.renderTo("reader-container", {
        manager: "continuous",
        flow: "scrolled",
        width: "100%",
        height: "100%",
        snap: false // Tắt snap để cuộn mượt hơn, dễ ăn event cuộn ngược
    });

    // Fix lỗi mất đà cuộn trên điện thoại iOS/Safari
    rendition.hooks.content.register(function(contents, view) {
        contents.document.body.style.WebkitOverflowScrolling = 'touch';
    });

    registerThemes();
    loadSettings();
    renderBookmarks();

    const lastLocation = localStorage.getItem(STORAGE_PREFIX + 'lastRead');
    if (lastLocation) {
        rendition.display(lastLocation);
    } else {
        rendition.display();
    }

    // FIX NHẬN DIỆN CHƯƠNG KHI CUỘN
    rendition.on("relocated", (location) => {
        currentLocationCfi = location.start.cfi;
        localStorage.setItem(STORAGE_PREFIX + 'lastRead', currentLocationCfi);
        
        // Loại bỏ phần #hash phía sau (nếu có) để tìm chính xác tên chương
        const cleanHref = location.start.href.split('#')[0];
        let navItem = book.navigation.get(cleanHref) || book.navigation.get(location.start.href);
        
        if(navItem) {
            currentChapterName = navItem.label;
            
            // Tự động Highlight chương đang đọc trong Sidebar
            document.querySelectorAll('.chapter-link').forEach(el => el.classList.remove('active'));
            const links = Array.from(document.querySelectorAll('.chapter-link'));
            const activeLink = links.find(el => el.textContent.trim() === currentChapterName.trim());
            if (activeLink) activeLink.classList.add('active');
        }
    });

    book.loaded.navigation.then((nav) => {
        const list = document.getElementById('chapter-list');
        list.innerHTML = nav.map(chapter => 
            `<a class="chapter-link" onclick="goTo('${chapter.href}')">${chapter.label}</a>`
        ).join("");
    });
};

function goTo(hrefOrCfi) {
    rendition.display(hrefOrCfi);
    closeAllPanels();
}

function registerThemes() {
    rendition.themes.register("dark", { 
        "body": { "background": "#121212", "color": "#d4d4d4" },
        "a": { "color": "#375a7f" }
    });
    rendition.themes.register("light", { 
        "body": { "background": "#f8f9fa", "color": "#212529" },
        "a": { "color": "#007bff" }
    });
}

function loadSettings() {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches && !localStorage.getItem(STORAGE_PREFIX + 'theme')) {
        document.body.setAttribute('data-theme', 'dark');
    } else {
        const theme = localStorage.getItem(STORAGE_PREFIX + 'theme');
        if (theme) document.body.setAttribute('data-theme', theme);
    }

    const fFamily = localStorage.getItem(STORAGE_PREFIX + 'font') || "'Times New Roman', serif";
    const fSize = localStorage.getItem(STORAGE_PREFIX + 'size') || "21";
    const fLine = localStorage.getItem(STORAGE_PREFIX + 'line') || "1.8";
    
    document.getElementById('fontFamily').value = fFamily;
    document.getElementById('fontSize').value = fSize;
    document.getElementById('lineHeight').value = fLine;
    
    applySettings(false);
}

function applySettings(save = true) {
    const fFamily = document.getElementById('fontFamily').value;
    const fSize = document.getElementById('fontSize').value;
    const fLine = document.getElementById('lineHeight').value;
    const isDark = document.body.getAttribute('data-theme') === 'dark';

    document.getElementById('fontSizeVal').innerText = fSize;
    document.getElementById('lineHeightVal').innerText = fLine;

    rendition.themes.font(fFamily);
    rendition.themes.fontSize(fSize + "px");
    rendition.themes.override("line-height", fLine);
    rendition.themes.select(isDark ? "dark" : "light");

    if (save) {
        localStorage.setItem(STORAGE_PREFIX + 'font', fFamily);
        localStorage.setItem(STORAGE_PREFIX + 'size', fSize);
        localStorage.setItem(STORAGE_PREFIX + 'line', fLine);
    }
}

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem(STORAGE_PREFIX + 'theme', isDark ? 'light' : 'dark');
    applySettings(true);
}

function addBookmark() {
    if (!currentLocationCfi) return;
    const exists = savedBookmarks.find(b => b.cfi === currentLocationCfi);
    if (!exists) {
        savedBookmarks.push({ cfi: currentLocationCfi, name: currentChapterName });
        localStorage.setItem(STORAGE_PREFIX + 'bookmarks', JSON.stringify(savedBookmarks));
        renderBookmarks();
        alert(`🔖 Đã lưu đoạn đang đọc thuộc chương:\n${currentChapterName}`);
    } else {
        alert("Bạn đã lưu vị trí này rồi.");
    }
}

function removeBookmark(event, index) {
    event.stopPropagation();
    savedBookmarks.splice(index, 1);
    localStorage.setItem(STORAGE_PREFIX + 'bookmarks', JSON.stringify(savedBookmarks));
    renderBookmarks();
}

function renderBookmarks() {
    const list = document.getElementById('bookmark-list');
    if(savedBookmarks.length === 0) {
        list.innerHTML = "<div style='font-size:13px; color:gray;'>Chưa có bookmark nào.</div>";
        return;
    }
    list.innerHTML = savedBookmarks.map((bm, idx) => `
        <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px; padding-bottom: 4px; border-bottom: 1px dashed var(--border);">
            <a class="chapter-link" style="flex:1; margin:0; font-size:14px; border:none;" onclick="goTo('${bm.cfi}')">🔖 ${bm.name}</a>
            <button onclick="removeBookmark(event, ${idx})" style="padding:6px 10px; border:none; background:var(--bg); color:red; border-radius:4px;">✕</button>
        </div>
    `).join("");
}

function exportData() {
    const data = {
        lastRead: localStorage.getItem(STORAGE_PREFIX + 'lastRead'),
        bookmarks: localStorage.getItem(STORAGE_PREFIX + 'bookmarks'),
        theme: localStorage.getItem(STORAGE_PREFIX + 'theme'),
        font: localStorage.getItem(STORAGE_PREFIX + 'font'),
        size: localStorage.getItem(STORAGE_PREFIX + 'size'),
        line: localStorage.getItem(STORAGE_PREFIX + 'line')
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Vo-Than-Backup.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.lastRead) localStorage.setItem(STORAGE_PREFIX + 'lastRead', data.lastRead);
            if (data.bookmarks) localStorage.setItem(STORAGE_PREFIX + 'bookmarks', data.bookmarks);
            if (data.theme) localStorage.setItem(STORAGE_PREFIX + 'theme', data.theme);
            if (data.font) localStorage.setItem(STORAGE_PREFIX + 'font', data.font);
            if (data.size) localStorage.setItem(STORAGE_PREFIX + 'size', data.size);
            if (data.line) localStorage.setItem(STORAGE_PREFIX + 'line', data.line);
            alert("✅ Phục hồi dữ liệu thành công! Trang web sẽ tải lại.");
            location.reload();
        } catch (err) {
            alert("❌ Lỗi: File dữ liệu không hợp lệ.");
        }
    };
    reader.readAsText(file);
}

function toggleSidebar() { 
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('settings-panel').classList.remove('open');
    checkOverlay();
    // Cuộn tới chapter đang đọc trong sidebar
    if (document.getElementById('sidebar').classList.contains('open')) {
        const activeItem = document.querySelector('.chapter-link.active');
        if(activeItem) activeItem.scrollIntoView({ block: 'center' });
    }
}
function toggleSettings() { 
    document.getElementById('settings-panel').classList.toggle('open');
    document.getElementById('sidebar').classList.remove('open');
    checkOverlay();
}
function closeAllPanels() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('settings-panel').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
}
function checkOverlay() {
    const isAnyOpen = document.getElementById('sidebar').classList.contains('open') || document.getElementById('settings-panel').classList.contains('open');
    document.getElementById('overlay').classList.toggle('show', isAnyOpen);
}
