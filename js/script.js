function openMenu() {
    document
    .getElementById("sidebar")
    .classList.add("active");
}

function closeMenu() {
    document
    .getElementById("sidebar")
    .classList.remove("active");
}

function dismissMenuHint(event) {
    event.stopPropagation();
    const hint = document.getElementById("menuHint");
    if (hint) hint.remove();
}
