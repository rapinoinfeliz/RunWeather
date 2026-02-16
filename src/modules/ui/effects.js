export function initRipple() {
    document.addEventListener('click', function (e) {
        // Check if target or parent is a .btn, .tag-btn, .tab-btn
        const btn = e.target.closest('.btn, .tag-btn, .tab-btn, .insight-btn, .page-btn, .gps-btn');
        if (btn) {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const circle = document.createElement('span');
            const diameter = Math.max(rect.width, rect.height);
            const radius = diameter / 2;

            circle.style.width = circle.style.height = `${diameter}px`;
            circle.style.left = `${x - radius}px`;
            circle.style.top = `${y - radius}px`;
            circle.classList.add('ripple');

            const ripple = btn.getElementsByClassName('ripple')[0];

            if (ripple) {
                ripple.remove();
            }

            btn.appendChild(circle);

            // Clean up after animation
            setTimeout(() => {
                circle.remove();
            }, 600);
        }
    });
}
