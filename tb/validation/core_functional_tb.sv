`timescale 1ns/1ps
// AI-authored functional regression of the unmodified recovered reference core.
// No wrapper, trigger, payload, or network/board interface is instantiated.
module core_functional_tb;
    reg SCK=0, RST_N=1, MOSI=0, NORM_CS_N=1, START=0, ENC_DEC=0;
    wire MISO, BUSY, ICE_LED;
    reference_top dut(.*);
    integer half_ns=10000, cycle=0, vectors=0, parcels=0, rows;
    integer n, b, k;
    reg [31:0] input_word, encrypted, recovered, decrypted, restored;
    reg [31:0] expected, rx, rng=32'h6b8b4567;
    reg ignored;
    string csv_path, vcd_path;

    task automatic require(input bit ok, input string why);
        if (!ok) $fatal(1,"FAIL cycle=%0d: %s",cycle,why);
    endtask

    task automatic pulse(output reg sampled);
        begin
            require(SCK===0,"clock begins idle-low");
            #(half_ns); SCK=1; #100; sampled=MISO; cycle=cycle+1;
            require((BUSY===0)||(BUSY===1),"BUSY is known");
            require(ICE_LED===BUSY,"LED mirrors BUSY");
            #(half_ns-100); SCK=0;
        end
    endtask

    task automatic reset_core;
        reg unused;
        begin
            START=0; NORM_CS_N=1;
            RST_N=0; pulse(unused); require(BUSY===0,"reset clears BUSY");
            RST_N=1; pulse(unused); require(BUSY===0,"idle after reset");
        end
    endtask

    task automatic transfer(input [31:0] tx, input integer count, output reg [31:0] got);
        integer bit_index; reg one;
        begin
            NORM_CS_N=0; got=0;
            for(bit_index=31;bit_index>=32-count;bit_index=bit_index-1) begin
                MOSI=tx[bit_index]; pulse(one);
                require((one===0)||(one===1),"MISO is known during transfer");
                got={got[30:0],one};
            end
            NORM_CS_N=1; #1;
        end
    endtask

    task automatic transform(input bit mode, input [31:0] word_in, output reg [31:0] word_out);
        integer extra; reg unused; reg [31:0] discarded; reg [7:0] busy_pattern;
        begin
            ENC_DEC=mode;
            transfer(word_in,32,discarded);
            START=1; pulse(unused); START=0; busy_pattern[7]=BUSY;
            for(extra=1;extra<=7;extra=extra+1) begin
                pulse(unused); busy_pattern[7-extra]=BUSY;
            end
            require(busy_pattern===8'b11100000,"completion pattern after START plus seven pulses");
            transfer(32'b0,32,word_out);
        end
    endtask

    task automatic check_word(input [31:0] word_in, input string category);
        begin
            reset_core();
            transform(0,word_in,encrypted);
            // No reset between inverse operations: also check sequential reuse.
            transform(1,encrypted,recovered);
            require(recovered===word_in,$sformatf("D(E(x)) mismatch x=%08x got=%08x",word_in,recovered));
            transform(1,word_in,decrypted);
            transform(0,decrypted,restored);
            require(restored===word_in,$sformatf("E(D(x)) mismatch x=%08x got=%08x",word_in,restored));
            if(word_in===32'h59c359c3)
                require(encrypted===32'h9cd84392,"published encryption known-answer");
            if(word_in===32'h9cd84392)
                require(decrypted===32'h59c359c3,"published decryption known-answer");
            $fdisplay(rows,"roundtrip,%s,%08x,%08x,%08x,%08x,%08x,32,PASS",category,word_in,encrypted,recovered,decrypted,restored);
            vectors=vectors+1;
        end
    endtask

    initial begin
        if(!$value$plusargs("HALF_NS=%d",half_ns)) half_ns=10000;
        require(half_ns>=500,"functional clock must not exceed 1 MHz");
        if(!$value$plusargs("CSV=%s",csv_path)) csv_path="core-functional.csv";
        rows=$fopen(csv_path,"w"); require(rows!=0,"CSV opens");
        $fdisplay(rows,"test,category,input,encrypted,recovered,decrypted,restored,bits,result");
        if($value$plusargs("VCD=%s",vcd_path)) begin
            $dumpfile(vcd_path);
            $dumpvars(0,SCK,RST_N,MOSI,NORM_CS_N,START,ENC_DEC,MISO,BUSY,ICE_LED);
        end

        // A deliberately wrong published answer must fail the checker.
        if($test$plusargs("BAD_EXPECT")) begin
            reset_core(); transform(0,32'h59c359c3,encrypted);
            require(encrypted===32'h9cd84393,"negative control wrong known answer");
            $fatal(1,"negative control unexpectedly passed");
        end

        check_word(32'h59c359c3,"known-plain");
        check_word(32'h9cd84392,"known-cipher");
        check_word(32'h00000000,"edge"); check_word(32'hffffffff,"edge");
        check_word(32'haaaaaaaa,"alternating"); check_word(32'h55555555,"alternating");
        check_word(32'h01234567,"ramp"); check_word(32'h89abcdef,"ramp");
        for(b=0;b<32;b=b+1) begin
            check_word(32'b1<<b,"walking-one");
            check_word(~(32'b1<<b),"walking-zero");
        end
        for(k=0;k<256;k=k+1) begin
            rng=rng^(rng<<13); rng=rng^(rng>>17); rng=rng^(rng<<5);
            check_word(rng,"deterministic-sample");
        end

        // Short parcels exercise ordinary shift-register semantics only.
        // They do not imply that the core has a malformed-frame alarm.
        for(n=1;n<32;n=n+1) begin
            reset_core(); ENC_DEC=0;
            transfer(32'hc3a59678,32,rx);
            transfer(32'h12345678,n,rx);
            expected=(32'hc3a59678<<n)|(32'h12345678>>(32-n));
            transfer(32'b0,32,rx);
            require(rx===expected,$sformatf("short-transfer shift mismatch bits=%0d",n));
            require(BUSY===0,"ordinary shift leaves core idle");
            $fdisplay(rows,"short-shift,length,%08x,,,,%08x,%0d,PASS",expected,rx,n);
            parcels=parcels+1;
        end
        require(vectors==328,"all round-trip vectors ran");
        require(parcels==31,"all short-transfer lengths ran");
        $display("CORE_FUNCTIONAL_PASS vectors=%0d inverse_checks=%0d short_lengths=%0d cycles=%0d half_ns=%0d",vectors,2*vectors,parcels,cycle,half_ns);
        $fclose(rows); $finish;
    end
    initial begin #3000000000; $fatal(1,"FAIL functional watchdog"); end
endmodule
