import { SUPPORT_EMAIL } from "@/lib/constants";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">개인정보처리방침</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        &quot;툴허브&quot;(이하 &quot;회사&quot;)는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련
        법령을 준수하고 있습니다.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        <section>
          <h2 className="text-lg font-semibold">1. 수집하는 개인정보 항목</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>필수 항목: 이메일 주소, 비밀번호(암호화 저장)</li>
            <li>
              매물 등록 시: 판매자가 직접 입력하는 연락처 정보(이메일, 카카오톡 ID, 텔레그램 등 연락
              수단) 해당 정보는 매물 상세 페이지를 통해 구매 희망자에게 공개됩니다.
            </li>
            <li>선택 항목: 프로필 이미지</li>
            <li>자동 수집 항목: 접속 IP 정보, 쿠키(로그인 세션 유지 목적), 서비스 이용 기록</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. 개인정보의 수집 및 이용 목적</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>회원 식별, 로그인 처리 및 이메일 인증을 통한 실사용자 확인</li>
            <li>매물 등록자와 구매 희망자 간의 원활한 연락 및 거래 연결</li>
            <li>비밀번호 재설정 등 계정 관리 및 고객 문의 대응</li>
            <li>서비스 부정 이용 방지 및 비인가 사용 방지</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. 개인정보의 보유 및 이용 기간</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              이용자의 개인정보는 원칙적으로 회원 탈퇴 요청 시 14일간 보관 후 지체 없이 영구
              파기합니다.
              <ul className="mt-2 list-[circle] space-y-1 pl-5">
                <li>
                  보관 목적: 탈퇴 후 재가입을 통한 부정 이용 방지, 거래 관련 분쟁 해결 및 이용자의
                  실수로 인한 탈퇴 복구 요청 대응
                </li>
              </ul>
            </li>
            <li>
              단, 관계 법령의 규정에 의하여 보존할 필요가 있는 경우 해당 법령에서 정한 일정 기간 동안
              별도 DB로 분리하여 보관합니다.
              <ul className="mt-2 list-[circle] space-y-1 pl-5">
                <li>
                  전자상거래 등에서의 소비자보호에 관한 법률:
                  <ul className="mt-1 list-square space-y-1 pl-5">
                    <li>표시/광고에 관한 기록: 6개월</li>
                    <li>계약 또는 청약철회, 대금결제, 재화 등의 공급에 관한 기록: 5년</li>
                    <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년</li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. 개인정보의 제3자 제공 및 공개</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>회사는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다.</li>
            <li>
              다만, 판매자가 매물 등록 시 직접 입력한 연락처 정보는 구매 희망자와의 거래 연결을 위해
              매물 상세 페이지에 공개됩니다. 판매자는 매물 등록 시 해당 정보의 공개에 동의한 것으로
              간주합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. 개인정보 처리업무의 위탁 및 국외 이전</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            회사는 원활한 서비스 제공을 위해 아래와 같이 외부 전문업체에 개인정보 처리 업무를 위탁하고
            있으며, 서버 위치에 따라 국외로 이전될 수 있습니다.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>Resend: 이메일 인증 및 시스템 알림 발송 (미국)</li>
            <li>Neon (PostgreSQL): 데이터베이스 호스팅 및 사용자 데이터 저장 (미국/해외 서버)</li>
            <li>Vercel: 웹 서비스 호스팅 및 배포 (미국/해외 CDN)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. 이용자의 권리와 행사 방법</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              이용자는 언제든지 등록되어 있는 자신의 개인정보를 열람하거나 수정할 수 있으며, 회원
              탈퇴를 통해 개인정보 삭제를 요청할 수 있습니다.
            </li>
            <li>문의 사항은 아래의 관리자 이메일로 연락 주시면 지체 없이 조치하겠습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. 개인정보의 파기 절차 및 방법</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              파기 기한: 이용자의 개인정보는 탈퇴 후 14일의 유예 기간이 경과한 날로부터 5일 이내에
              영구 파기합니다.
            </li>
            <li>
              파기 방법: 전자적 파일 형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을
              사용하여 영구 삭제합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. 개인정보 보호책임자</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>담당자: 도형</li>
            <li>문의 이메일: {SUPPORT_EMAIL}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. 고지의 의무</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            본 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및
            수정이 있는 경우에는 공지사항을 통해 변경 사항을 고지합니다.
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        시행일자: 2026년 9월 9일
      </p>
    </main>
  );
}
