import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp, tooManyResponse } from "@/lib/rateLimit";

// 계정 무한 생성 방지: 같은 IP 기준 1시간에 10회까지
const SIGNUP_LIMIT = 10;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest){

    try{
        const rl = rateLimit(`signup:${getClientIp(req)}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);
        if (!rl.allowed) {
            return tooManyResponse(rl.retryAfterSec, "가입 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.");
        }

        const {email, password, name} = await req.json();


        // 1. 입력값 기본 검증
        if (!email || !password){
            return NextResponse.json(
                {error: "이메일과 비밀번호는 필수입니다."},
                {status: 400}
            );
        }

        // 1-1. 이메일 정규화 + 형식 검사
        const normalizedEmail = String(email).trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)){
            return NextResponse.json(
                {error: "올바른 이메일 형식이 아닙니다."},
                {status: 400}
            );
        }

        // 1-2. 비밀번호 길이 검증
        // (bcrypt는 72바이트까지만 반영하므로 그 이상은 의미가 없고,
        //  지나치게 긴 입력은 해싱 부하만 키운다)
        if (String(password).length < 8 || String(password).length > 72){
            return NextResponse.json(
                {error: "비밀번호는 8~72자여야 합니다."},
                {status: 400}
            );
        }

        //2. 이미 가입된 이메일인지 확인
        const existingUser = await prisma.user.findUnique({
            where:{email: normalizedEmail},
        });

        if(existingUser){
            return NextResponse.json(
                {error: "이미 사용 중인 이메일입니다."},
                {status: 409}
            );
        }

        // 3. 비밀번호 해싱 (평문 저장 금지)
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. DB에 유저 저장
        const user = await prisma.user.create({
            data: {
                email: normalizedEmail,
                password: hashedPassword,
                name: name || null,
            },
        });


        // 5. 응답 (비밀번호는 절대 응답에 포함 안 함)
        return NextResponse.json(
            {
                message: "회원가입 성공",
                user: {id: user.id, email: user.email, name: user.name},
            },
            {status: 200}
        );
    } catch (error) {
        console.error("회원가입 에러:", error);
        return NextResponse.json(
            {error: "서버 오류가 발생했습니다."},
            {status: 500}
        );
    }
}