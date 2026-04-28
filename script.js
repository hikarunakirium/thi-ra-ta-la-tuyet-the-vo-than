let book;
let rendition;
let currentLocationCfi = "";
let currentChapterName = "Đang đọc...";
let GLOBAL_PREFIX = "epub_global_"; 
let BOOK_PREFIX = "epub_book_"; // Sẽ được gán tự động theo tên file
let savedBookmarks = [];

window.onload = () => {
    // Lúc đầu chỉ load giao diện chung
    loadSettings();
};

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Lọc ký tự đặc biệt của tên file để làm id riêng cho mỗi cuốn sách
    BOOK_PREFIX = "epub_" + file.name.replace(/[^a-zA-Z0-9]/g, '') + "_";
    savedBookmarks = JSON.parse(localStorage.getItem(BOOK_PREFIX + 'bookmarks') || '[]');

    // Ẩn màn hình upload
    document.getElementById('upload-screen').style.display = 'none';

    // Xóa sách hiện tại (nếu có) khi muốn mở sách khác
    if (book) {
        book.destroy();
        document.getElementById("reader-container").innerHTML = "";
    }

    // Đọc file EPUB dưới dạng ArrayBuffer để dùng cho ePub.js
    const reader = new FileReader();
    reader.onload = function(e) {
        initReader(e.target.result);
    };
    reader.readAsArrayBuffer(file);
}

function initReader(bookData) {
    book = ePub(bookData);
    rendition = book.renderTo("reader-container", {
        manager: "continuous",
        flow: "scrolled",
        width: "100%",
        height: "100%",
        snap: false // Cuộn mượt trên điện thoại
    });

    rendition.hooks.content.register(function(contents, view) {
        contents.document.body.style.WebkitOverflowScrolling = 'touch';
    });

    registerThemes();
    applySettings(false); 
    renderBookmarks();

    const lastLocation = localStorage.getItem(BOOK_PREFIX + 'lastRead');
    if (lastLocation) {
        rendition.display(lastLocation);
    } else {
        rendition.display();
    }

    rendition.on("relocated", (location) => {
        currentLocationCfi = location.start.cfi;
        localStorage.setItem(BOOK_PREFIX + 'lastRead', currentLocationCfi);
        
        const cleanHref = location.start.href.split('#')[0];
        let navItem = book.navigation.get(cleanHref) || book.navigation.get(location.start.href);
        
        if(navItem) {
            currentChapterName = navItem.label;
            
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
}

function goTo(hrefOrCfi) {
    if(rendition) rendition.display(hrefOrCfi);
    closeAllPanels();
}

function registerThemes() {
    if(!rendition) return;
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
    if (window.matchMedia('(prefers-color-scheme: dark)').matches && !localStorage.getItem(GLOBAL_PREFIX + 'theme')) {
        document.body.setAttribute('data-theme', 'dark');
    } else {
        const theme = localStorage.getItem(GLOBAL_PREFIX + 'theme');
        if (theme) document.body.setAttribute('data-theme', theme);
    }

    const fFamily = localStorage.getItem(GLOBAL_PREFIX + 'font') || "'Times New Roman', serif";
    const fSize = localStorage.getItem(GLOBAL_PREFIX + 'size') || "21";
    const fLine = localStorage.getItem(GLOBAL_PREFIX + 'line') || "1.8";
    
    document.getElementById('fontFamily').value = fFamily;
    document.getElementById('fontSize').value = fSize;
    document.getElementById('lineHeight').value = fLine;
    
    if(rendition) applySettings(false);
}

function applySettings(save = true) {
    const fFamily = document.getElementById('fontFamily').value;
    const fSize = document.getElementById('fontSize').value;
    const fLine = document.getElementById('lineHeight').value;
    const isDark = document.body.getAttribute('data-theme') === 'dark';

    document.getElementById('fontSizeVal').innerText = fSize;
    document.getElementById('lineHeightVal').innerText = fLine;

    if(rendition) {
        rendition.themes.font(fFamily);
        rendition.themes.fontSize(fSize + "px");
        rendition.themes.override("line-height", fLine);
        rendition.themes.select(isDark ? "dark" : "light");
    }

    if (save) {
        localStorage.setItem(GLOBAL_PREFIX + 'font', fFamily);
        localStorage.setItem(GLOBAL_PREFIX + 'size', fSize);
        localStorage.setItem(GLOBAL_PREFIX + 'line', fLine);
    }
}

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem(GLOBAL_PREFIX + 'theme', isDark ? 'light' : 'dark');
    applySettings(true);
}

function addBookmark() {
    if (!currentLocationCfi) return;
    const exists = savedBookmarks.find(b => b.cfi === currentLocationCfi);
    if (!exists) {
        savedBookmarks.push({ cfi: currentLocationCfi, name: currentChapterName });
        localStorage.setItem(BOOK_PREFIX + 'bookmarks', JSON.stringify(savedBookmarks));
        renderBookmarks();
        alert(`🔖 Đã lưu đoạn đang đọc thuộc chương:\n${currentChapterName}`);
    } else {
        alert("Bạn đã lưu vị trí này rồi.");
    }
}

function removeBookmark(event, index) {
    event.stopPropagation();
    savedBookmarks.splice(index, 1);
    localStorage.setItem(BOOK_PREFIX + 'bookmarks', JSON.stringify(savedBookmarks));
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
        lastRead: localStorage.getItem(BOOK_PREFIX + 'lastRead'),
        bookmarks: localStorage.getItem(BOOK_PREFIX + 'bookmarks'),
        theme: localStorage.getItem(GLOBAL_PREFIX + 'theme'),
        font: localStorage.getItem(GLOBAL_PREFIX + 'font'),
        size: localStorage.getItem(GLOBAL_PREFIX + 'size'),
        line: localStorage.getItem(GLOBAL_PREFIX + 'line')
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Backup_EPUB.json';
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
            if (data.lastRead) localStorage.setItem(BOOK_PREFIX + 'lastRead', data.lastRead);
            if (data.bookmarks) localStorage.setItem(BOOK_PREFIX + 'bookmarks', data.bookmarks);
            if (data.theme) localStorage.setItem(GLOBAL_PREFIX + 'theme', data.theme);
            if (data.font) localStorage.setItem(GLOBAL_PREFIX + 'font', data.font);
            if (data.size) localStorage.setItem(GLOBAL_PREFIX + 'size', data.size);
            if (data.line) localStorage.setItem(GLOBAL_PREFIX + 'line', data.line);
            
            alert("✅ Phục hồi dữ liệu thành công!");
            loadSettings();
            renderBookmarks();
            if(rendition && data.lastRead) rendition.display(data.lastRead);
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
