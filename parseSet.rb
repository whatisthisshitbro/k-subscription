if (ARGV.size>0)
	f=File.new(ARGV[0])
	line=f.gets
	mark="defaultChannels:["
	s="\t"+mark
	while(line=f.gets)
	        part=line.chop.split(';')
	        s=s+'{chnl:"'+part[0]+'",followers:'+part[1]+',friend:false},'
        end
	f.close
	str=''
	f=File.new('lib/options_backend.js')
	while(line=f.gets)
	        if line.include? mark
	                str=str+s+"],\n"
	        else
	                str=str+line
	        end
	end
	f.close
	fw=File.open('lib/options_backend.js','w')
	fw.write(str)
	fw.close
else
	puts "Usage: ruby parseSet.rb <filename.csv>"
end
