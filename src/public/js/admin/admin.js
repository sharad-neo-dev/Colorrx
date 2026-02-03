$(window).on("load", function () {
  setTimeout(() => {
    $("#preloader").fadeOut(0);
  }, 100);
});
$(document).ready(function () {
  $(`a[href="${window.location.pathname}"]`).addClass("active");
  $(`a[href="${window.location.pathname}"]`).css("pointerEvents", "none");
});

$(".back-to-tops").click(function () {
  $("html, body").animate(
    {
      scrollTop: 0,
    },
    800,
  );
  return false;
});

function formatMoney(money) {
  // Check if the input is a valid number
  if (isNaN(money)) {
    return "Invalid input";
  }

  // Convert to a fixed number with 2 decimal places
  money = parseFloat(money).toFixed(2);

  // Add comma separators for thousands
  return String(money).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}

let checkID = $("html").attr("data-change");
let i = 0;
if (checkID == 1) i = 1;
if (checkID == 2) i = 3;
if (checkID == 3) i = 5;
if (checkID == 4) i = 30; // 30 seconds
function cownDownTimer() {
  var countDownDate = new Date("2030-07-16T23:59:59.9999999+01:00").getTime();
  setInterval(function () {
    var now = new Date().getTime();
    var distance = countDownDate - now;
    var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

    let minute = 0;
    let seconds = Math.floor((distance % (1000 * 60)) / 1000);

    // Special handling for 30-second game
    if (checkID == 4) {
      seconds = seconds % 30;
    } else {
      minute = Math.ceil(minutes % i);
    }

    var seconds1 = Math.floor(seconds / 10);
    var seconds2 = seconds % 10;

    if (checkID != 1 && checkID != 4) {
      $(".time .time-sub:eq(1)").text(minute);
    } else {
      $(".time .time-sub:eq(1)").text("0");
    }

    $(".time .time-sub:eq(2)").text(seconds1);
    $(".time .time-sub:eq(3)").text(seconds2);
  }, 0);
}

cownDownTimer();
