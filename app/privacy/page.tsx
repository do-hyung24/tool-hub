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
          <h2 className="text-lg font-semibold">1. 수집하는 개인정보 항목 및 수집 방법</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>회원가입 시 필수 항목: 이메일 주소, 비밀번호(암호화하여 저장), 닉네임</li>
            <li>회원가입 후 선택 항목: 프로필 이미지</li>
            <li>
              자동화 툴 의뢰 등록 시: 의뢰 제목·설명(필수), 예산·희망 완료 시점·필요 프로그램/환경·참고
              영상 링크·첨부 이미지(선택)
            </li>
            <li>제안 등록 시: 제안 가격, 완료 예정일, 제안 설명(필수)</li>
            <li>제안이 선택된 이후: 의뢰자와 선택된 제작자만 볼 수 있는 비공개 협의 스레드의 메시지</li>
            <li>
              완성본 제출 시: 완성본 코드(GitHub 저장소 링크 또는 zip 파일 업로드), 실행 가이드
              텍스트(필수)
            </li>
            <li>매물(마켓) 등록 시: 매물 제목·설명·가격·카테고리, 완성본 코드(GitHub 링크 또는 zip)</li>
            <li>커뮤니티 게시판·댓글 이용 시: 작성한 게시글 및 댓글 내용</li>
            <li>고객의 목소리(피드백) 제출 시: 문의 카테고리, 문의 내용</li>
            <li>
              자동 수집 항목: 로그인 세션 유지를 위한 인증 쿠키. 이 외에 호스팅 인프라(Vercel)가 서비스
              운영·보안 목적으로 자동 생성하는 접속 로그(접속 IP 등)가 있을 수 있습니다.
            </li>
            <li>
              수집 방법: 회원가입 및 서비스 이용 과정에서 이용자가 직접 입력하거나 파일을 첨부(업로드)하는
              방식으로 수집합니다.
            </li>
            <li>
              회사는 정산 계좌번호 등 금융정보를 수집하지 않습니다. 거래(결제)는 의뢰자와 제작자가 직접
              진행하며, 회사는 의뢰-제안 매칭과 완성본 보안 스캔 결과 확인까지의 연결만 제공합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. 개인정보의 수집 및 이용 목적</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>회원 식별, 로그인 처리 및 이메일 인증을 통한 실사용자 확인</li>
            <li>자동화 툴 의뢰와 제안의 등록·매칭 및 진행 상태 관리</li>
            <li>제작자가 제출한 완성본의 자동 보안 스캔 및 스캔 결과 안내</li>
            <li>의뢰자와 제작자 간 거래(제안 선택, 비공개 협의, 완성본 확인) 진행 지원</li>
            <li>비밀번호 재설정 등 계정 관리 및 고객 문의·피드백 대응</li>
            <li>공지사항 등 서비스 관련 사항 전달</li>
            <li>서비스 부정 이용 방지 및 비인가 사용 방지</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. 개인정보의 보유 및 이용 기간, 파기</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              이용자의 개인정보는 원칙적으로 회원 탈퇴 요청 시 즉시 로그인이 차단되고 매물·공개 프로필이
              비공개 처리되며, 14일간의 유예 기간이 지나면 관련 데이터를 지체 없이 영구 파기합니다.
              <ul className="mt-2 list-[circle] space-y-1 pl-5">
                <li>
                  보관 목적: 탈퇴 후 재가입을 통한 부정 이용 방지, 거래 관련 분쟁 해결 및 이용자의
                  실수로 인한 탈퇴 복구 요청 대응
                </li>
              </ul>
            </li>
            <li>
              단, 관계 법령의 규정에 의하여 보존할 필요가 있는 경우 해당 법령에서 정한 일정 기간 동안
              별도 보관합니다.
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
            <li>
              파기 기한: 이용자의 개인정보는 탈퇴 후 14일의 유예 기간이 경과한 날로부터 지체 없이 영구
              파기합니다.
            </li>
            <li>
              파기 방법: 데이터베이스에 저장된 개인정보는 복구할 수 없는 방법으로 영구 삭제합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. 제3자 제공 및 처리위탁</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            회사는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만 서비스 특성상 아래 정보는
            다른 이용자에게 공개됩니다.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              매물을 등록하면, 회원가입 시 등록한 이메일 주소가 &quot;판매자 연락처&quot;로 매물 상세
              페이지에 공개되어 로그인하지 않은 방문자도 열람할 수 있습니다.
            </li>
            <li>
              공개 프로필 페이지에는 닉네임, 프로필 이미지, 가입 후 경과 기간(개월/년차), 완료·진행 중
              거래 건수, 공개된 매물 목록이 표시됩니다.
            </li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            또한 회사는 원활한 서비스 제공을 위해 아래 업체에 개인정보 처리 업무를 위탁하고 있습니다.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-300 text-left text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">수탁사명</th>
                  <th className="py-2 pr-4 font-medium">위탁 업무</th>
                  <th className="py-2 font-medium">이전 국가</th>
                </tr>
              </thead>
              <tbody className="text-zinc-700 dark:text-zinc-300">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-4 align-top">Vercel</td>
                  <td className="py-2 pr-4 align-top">
                    웹 서비스 호스팅·배포, 첨부 이미지·완성본 코드 파일 저장(Blob Storage)
                  </td>
                  <td className="py-2 align-top">미국</td>
                </tr>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-4 align-top">Neon</td>
                  <td className="py-2 pr-4 align-top">데이터베이스(PostgreSQL) 호스팅 및 저장</td>
                  <td className="py-2 align-top">미국</td>
                </tr>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-4 align-top">Resend</td>
                  <td className="py-2 pr-4 align-top">
                    이메일 발송(회원가입 인증, 비밀번호 재설정, 의뢰 완료 알림, 피드백 접수 알림)
                  </td>
                  <td className="py-2 align-top">미국</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 align-top">Anthropic (Claude API)</td>
                  <td className="py-2 pr-4 align-top">
                    보안 스캔 고도화를 위해 규칙 기반 탐지에서 문맥 판단이 필요하다고 표시된 코드 일부를
                    AI로 재분석. 현재 기본값은 비활성화 상태이며, 운영자가 이 기능을 명시적으로 켠
                    경우에만 동작합니다.
                  </td>
                  <td className="py-2 align-top">미국</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. 개인정보의 국외 이전</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            회사는 위 4항의 수탁사를 통해 아래와 같이 개인정보를 국외로 이전하고 있습니다.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-300 text-left text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">이전받는 자</th>
                  <th className="py-2 pr-4 font-medium">이전되는 항목</th>
                  <th className="py-2 pr-4 font-medium">이전 국가</th>
                  <th className="py-2 pr-4 font-medium">이전 시점</th>
                  <th className="py-2 font-medium">이전 방법</th>
                </tr>
              </thead>
              <tbody className="text-zinc-700 dark:text-zinc-300">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-4 align-top">Vercel</td>
                  <td className="py-2 pr-4 align-top">
                    계정 식별 정보, 첨부 이미지·완성본 코드 파일 등 서비스 이용 중 생성되는 데이터 전반
                  </td>
                  <td className="py-2 pr-4 align-top">미국</td>
                  <td className="py-2 pr-4 align-top">서비스 이용 시(실시간)</td>
                  <td className="py-2 align-top">네트워크를 통한 전송</td>
                </tr>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-4 align-top">Neon</td>
                  <td className="py-2 pr-4 align-top">데이터베이스에 저장되는 개인정보 전체</td>
                  <td className="py-2 pr-4 align-top">미국</td>
                  <td className="py-2 pr-4 align-top">데이터 저장 시(실시간)</td>
                  <td className="py-2 align-top">네트워크를 통한 전송</td>
                </tr>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-4 align-top">Resend</td>
                  <td className="py-2 pr-4 align-top">이메일 주소, 이메일 본문(인증코드·안내 내용)</td>
                  <td className="py-2 pr-4 align-top">미국</td>
                  <td className="py-2 pr-4 align-top">이메일 발송 시</td>
                  <td className="py-2 align-top">네트워크를 통한 전송</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 align-top">Anthropic (Claude API)</td>
                  <td className="py-2 pr-4 align-top">
                    완성본 코드 일부(스니펫)와 파일 경로. 시크릿으로 보이는 값은 전송 전 마스킹 처리됩니다.
                  </td>
                  <td className="py-2 pr-4 align-top">미국</td>
                  <td className="py-2 pr-4 align-top">
                    보안 스캔 실행 시(기능이 활성화되어 있고, 규칙 기반 탐지에서 추가 판단이 필요하다고
                    표시된 항목이 있을 때만)
                  </td>
                  <td className="py-2 align-top">API를 통한 전송</td>
                </tr>
              </tbody>
            </table>
          </div>
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
          <h2 className="text-lg font-semibold">7. 개인정보의 안전성 확보 조치</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>비밀번호는 복호화가 불가능한 방식(bcrypt)으로 암호화하여 저장합니다.</li>
            <li>
              프로필 이미지, 의뢰 첨부 이미지, 완성본 코드 파일 등 업로드된 파일은 비공개(private) 저장소에
              보관되며, 인증된 서버 경로를 통해서만 접근할 수 있고 파일 URL이 외부에 직접 노출되지
              않습니다.
            </li>
            <li>
              선택된 제작자와의 비공개 협의 스레드는 해당 의뢰의 의뢰자와 선택된 제작자만 조회할 수 있도록
              접근 권한을 통제합니다.
            </li>
            <li>계정 삭제 등 관리자 전용 배치 작업은 별도의 비밀키로 인증된 요청만 처리합니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. 쿠키 등 자동수집장치</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>회사는 로그인 세션을 유지하기 위한 인증 쿠키만 사용하며, 광고·추적 목적의 쿠키는 사용하지 않습니다.</li>
            <li>
              이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 로그인 상태 유지 등
              일부 서비스 이용에 어려움이 있을 수 있습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. 개인정보 보호책임자</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>성명: [담당자 성명]</li>
            <li>문의 이메일: {SUPPORT_EMAIL}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">10. 고지의 의무</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            본 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및
            수정이 있는 경우에는 웹사이트 공지사항을 통해 변경 사항을 고지합니다.
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        시행일자: [YYYY년 M월 D일]
      </p>
    </main>
  );
}
