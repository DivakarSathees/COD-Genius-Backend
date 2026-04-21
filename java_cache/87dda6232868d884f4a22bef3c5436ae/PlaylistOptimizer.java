import java.util.*;
import java.io.*;
public class PlaylistOptimizer {
    public String processInput(String rawInput) {
        if (rawInput == null) return "Invalid input";
        String s = rawInput.trim();
        if (s.length() == 0) return "Invalid input";
        String[] tokens = s.split("\\s+");
        int idx = 0;
        int N;
        try {
            N = Integer.parseInt(tokens[0]);
        } catch (Exception e) {
            return "Invalid input";
        }
        if (N < 1 || N > 1000) return "Invalid input";
        if (tokens.length - 1 != N) return "Invalid input";
        int[] a = new int[N];
        for (int i = 0; i < N; i++) {
            try {
                a[i] = Integer.parseInt(tokens[i + 1]);
            } catch (Exception e) {
                return "Invalid input";
            }
            if (a[i] < -100000 || a[i] > 100000) return "Invalid input";
        }
        long sumP = 0;
        int countP = 0;
        for (int v : a) {
            if (v > 0) {
                sumP += v;
                countP++;
            }
        }
        long S1 = 0;
        if (countP > 0) {
            long avgP = sumP / countP;
            for (int v : a) {
                if (v > avgP) S1 += v;
            }
        } else {
            S1 = 0;
        }
        int Cneg = 0;
        for (int v : a) if (v < 0) Cneg++;
        int Lalt = 0;
        int curr = 0;
        int prevSign = 0;
        for (int v : a) {
            if (v == 0) {
                curr = 0;
                prevSign = 0;
            } else {
                int sign = v > 0 ? 1 : -1;
                if (curr == 0) {
                    curr = 1;
                } else {
                    if (sign != prevSign) curr++; else curr = 1;
                }
                prevSign = sign;
                if (curr > Lalt) Lalt = curr;
            }
        }
        if (Lalt == 0) {
            boolean anyNonZero = false;
            for (int v : a) if (v != 0) { anyNonZero = true; break; }
            if (!anyNonZero) Lalt = 0;
        }
        Set<Integer> setPos = new HashSet<Integer>();
        for (int v : a) if (v > 0) setPos.add(v);
        int Dpos = setPos.size();
        long X = S1 + ((long) Cneg * (long) Lalt) - Dpos;
        return "Sum is " + X;
    }
}
public class Main {
    public static void main(String[] args) {
        java.util.Scanner scanner = new java.util.Scanner(System.in);
        String input = "";
        if (scanner.hasNext()) input = scanner.useDelimiter("\\A").next();
        scanner.close();
        PlaylistOptimizer optimizer = new PlaylistOptimizer();
        String result = optimizer.processInput(input);
        System.out.println(result);
    }
}
