import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = "dohyung.p03@gmail.com";
const NICKNAME = `resendtest${Date.now()}`;
const PASSWORD = "TestPass123!";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();

  await page.goto(`${BASE}/signup`);
  await page.fill("#email", EMAIL);
  await page.getByRole("button", { name: "중복확인" }).first().click();
  await page.getByText(/사용 가능한 이메일입니다|이미 가입된 이메일입니다/).waitFor();
  const emailStatus = await page.locator("form p").first().innerText();
  console.log("이메일 상태:", emailStatus);

  if (emailStatus.includes("이미 가입된")) {
    console.log("이미 이 이메일로 가입된 계정이 있어 새 가입은 건너뜁니다.");
    await browser.close();
    return;
  }

  await page.fill("#nickname", NICKNAME);
  await page.getByRole("button", { name: "중복확인" }).nth(1).click();
  await page.getByText("사용 가능한 닉네임입니다").waitFor();
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL(`${BASE}/`);
  console.log("가입 완료:", EMAIL, "/", NICKNAME);

  await browser.close();
}

main().catch((e) => {
  console.error("실패:", e);
  process.exit(1);
});
